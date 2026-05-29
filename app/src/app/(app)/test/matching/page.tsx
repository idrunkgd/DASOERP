import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { rankMatches, type MatchableProfile, type MatchResult } from "@/lib/mission-matching";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, X, ChevronRight, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type SourceKind = "request" | "mission";

export default async function MatchingPage({
  searchParams
}: {
  searchParams: { source?: string; includeCandidates?: string };
}) {
  await requirePermissionOrRedirect("consulting.read");

  // Toutes les sources possibles : demandes ouvertes + missions actives/prolongées/on-hold
  // + demandes contractualisées (au cas où on veut quand même rejouer un matching)
  const [openRequests, activeMissions] = await Promise.all([
    prisma.missionRequest.findMany({
      where: { status: { in: ["NEW", "QUALIFYING", "PRESENTING"] } },
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: "desc" }
    }),
    prisma.mission.findMany({
      where: { status: { in: ["PLANNED", "ACTIVE", "EXTENDED", "ON_HOLD"] } },
      include: {
        company: { select: { name: true } },
        consultant: { select: { id: true, firstName: true, lastName: true } },
        missionRequest: {
          select: {
            id: true,
            requiredSkills: true,
            seniority: true,
            targetDailyRate: true,
            maxDailyRate: true
          }
        }
      },
      orderBy: { startDate: "desc" }
    })
  ]);

  // Source par défaut : 1ère demande ouverte, sinon 1ère mission active
  const defaultSource = openRequests[0]
    ? `request:${openRequests[0].id}`
    : activeMissions[0]
      ? `mission:${activeMissions[0].id}`
      : "";
  const sourceRaw = searchParams.source ?? defaultSource;
  const [sourceKind, sourceId] = sourceRaw.includes(":")
    ? (sourceRaw.split(":") as [SourceKind, string])
    : ["request" as SourceKind, sourceRaw];

  const includeCandidates = searchParams.includeCandidates !== "0";

  let results: MatchResult[] = [];
  let header: {
    title: string;
    company: string;
    requiredSkills: string[];
    seniority: string | null;
    startDate: Date | null;
    targetDailyRate: number | null;
    maxDailyRate: number | null;
    excludeConsultantId: string | null;
    excludeConsultantName: string | null;
    isReplacement: boolean;
  } | null = null;

  if (sourceId) {
    if (sourceKind === "request") {
      const r = openRequests.find((x) => x.id === sourceId);
      if (r) {
        header = {
          title: `${r.reference} — ${r.title}`,
          company: r.company.name,
          requiredSkills: r.requiredSkills,
          seniority: r.seniority,
          startDate: r.startDate,
          targetDailyRate: r.targetDailyRate ? Number(r.targetDailyRate) : null,
          maxDailyRate: r.maxDailyRate ? Number(r.maxDailyRate) : null,
          excludeConsultantId: null,
          excludeConsultantName: null,
          isReplacement: false
        };
      }
    } else if (sourceKind === "mission") {
      const m = activeMissions.find((x) => x.id === sourceId);
      if (m) {
        header = {
          title: `${m.reference} — ${m.title}`,
          company: m.company.name,
          requiredSkills: m.missionRequest?.requiredSkills ?? [],
          seniority: m.missionRequest?.seniority ?? null,
          startDate: m.startDate,
          targetDailyRate: Number(m.dailyRate), // pour mission en cours, le rate facturé
          maxDailyRate: m.missionRequest?.maxDailyRate
            ? Number(m.missionRequest.maxDailyRate)
            : null,
          excludeConsultantId: m.consultantId ?? null,
          excludeConsultantName: m.consultant
            ? `${m.consultant.firstName} ${m.consultant.lastName}`
            : null,
          isReplacement: true
        };
      }
    }
  }

  if (header) {
    const [consultants, candidates] = await Promise.all([
      prisma.user.findMany({
        where: {
          active: true,
          role: "CONSULTANT",
          ...(header.excludeConsultantId ? { id: { not: header.excludeConsultantId } } : {})
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          skills: true,
          seniority: true,
          dailyCost: true
        }
      }),
      includeCandidates
        ? prisma.candidate.findMany({
            where: { status: "ACTIVE" },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              skills: true,
              seniority: true,
              dailyCost: true,
              availableFrom: true,
              status: true
            }
          })
        : Promise.resolve([])
    ]);

    const profiles: MatchableProfile[] = [
      ...consultants.map((u) => ({
        id: u.id,
        kind: "user" as const,
        firstName: u.firstName,
        lastName: u.lastName,
        skills: u.skills,
        seniority: u.seniority,
        dailyCost: u.dailyCost ? Number(u.dailyCost) : null,
        availableFrom: null,
        status: null
      })),
      ...candidates.map((c) => ({
        id: c.id,
        kind: "candidate" as const,
        firstName: c.firstName,
        lastName: c.lastName,
        skills: c.skills,
        seniority: c.seniority,
        dailyCost: c.dailyCost ? Number(c.dailyCost) : null,
        availableFrom: c.availableFrom,
        status: c.status
      }))
    ];

    results = rankMatches(
      {
        requiredSkills: header.requiredSkills,
        seniority: header.seniority,
        startDate: header.startDate,
        targetDailyRate: header.targetDailyRate,
        maxDailyRate: header.maxDailyRate
      },
      profiles
    );
  }

  return (
    <div>
      <PageHeader
        title="Matching mission ↔ profil"
        subtitle="Demande ouverte ou mission en cours (recherche de remplaçant) — classement automatique consultants & candidats"
      />

      <form className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[300px]">
          <label className="label">Source à matcher</label>
          <select name="source" defaultValue={sourceRaw} className="input">
            <option value="">— Sélectionner —</option>
            {openRequests.length > 0 && (
              <optgroup label="Demandes ouvertes">
                {openRequests.map((r) => (
                  <option key={`req-${r.id}`} value={`request:${r.id}`}>
                    {r.reference} — {r.title} ({r.company.name})
                  </option>
                ))}
              </optgroup>
            )}
            {activeMissions.length > 0 && (
              <optgroup label="Missions en cours (chercher un remplaçant)">
                {activeMissions.map((m) => (
                  <option key={`mis-${m.id}`} value={`mission:${m.id}`}>
                    {m.reference} — {m.title} ({m.company.name})
                    {m.consultant && ` · actuellement ${m.consultant.firstName} ${m.consultant.lastName}`}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            name="includeCandidates"
            value="1"
            defaultChecked={includeCandidates}
          />
          Inclure candidats externes
        </label>
        <button className="btn-primary">Matcher</button>
      </form>

      {header ? (
        <>
          {header.isReplacement && (
            <div className="card mb-4 p-3 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                <div>
                  <span className="font-medium text-amber-900">Recherche de remplaçant</span>
                  {header.excludeConsultantName && (
                    <span className="text-amber-700">
                      {" "}
                      — {header.excludeConsultantName} est actuellement sur cette mission. Il/elle est exclu(e) du classement.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="card mb-4 p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Info label="Mission" value={header.title} />
              <Info label="Client" value={header.company} />
              <Info label="Skills requis" value={header.requiredSkills.join(", ") || "—"} />
              <Info label="Séniorité" value={header.seniority ?? "—"} />
              <Info
                label={header.isReplacement ? "Début mission" : "Début"}
                value={header.startDate ? formatDate(header.startDate) : "—"}
              />
              <Info
                label={header.isReplacement ? "TJM client (facturé)" : "TJM cible"}
                value={
                  header.targetDailyRate
                    ? `${formatCurrency(header.targetDailyRate)}${
                        header.maxDailyRate ? ` (max ${formatCurrency(header.maxDailyRate)})` : ""
                      }`
                    : "—"
                }
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div className="font-semibold">Top profils ({results.length})</div>
              <div className="text-[11px] text-midnight-500">
                Score sur 100 : skills (60) + dispo (20) + rate (10) + séniorité (10)
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Profil</th>
                    <th>Type</th>
                    <th>Séniorité</th>
                    <th className="text-right">TJM coût</th>
                    <th>Skills match</th>
                    <th>Skills manquants</th>
                    <th className="text-right">Score</th>
                    <th>Détail</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center text-midnight-400 py-6">
                        Aucun profil trouvé.
                      </td>
                    </tr>
                  ) : (
                    results.map((r, i) => (
                      <tr key={r.profile.kind + r.profile.id} className="align-top">
                        <td className="text-xs text-midnight-500">{i + 1}</td>
                        <td className="font-medium">
                          {r.profile.firstName} {r.profile.lastName}
                        </td>
                        <td>
                          <span
                            className={`text-[10px] rounded px-1.5 py-0.5 ${
                              r.profile.kind === "user"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {r.profile.kind === "user" ? "Interne" : "Candidat"}
                          </span>
                        </td>
                        <td className="text-xs">{r.profile.seniority ?? "—"}</td>
                        <td className="text-right tabular-nums text-xs">
                          {r.profile.dailyCost ? formatCurrency(r.profile.dailyCost) : "—"}
                          {r.rateExceedsMax && (
                            <div className="text-[10px] text-red-600">&gt; max</div>
                          )}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {r.matchedSkills.map((s, j) => (
                              <span
                                key={j}
                                className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1 py-0.5"
                              >
                                <Check className="w-2.5 h-2.5 inline" /> {s}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {r.missingSkills.map((s, j) => (
                              <span
                                key={j}
                                className="text-[10px] bg-red-50 text-red-700 rounded px-1 py-0.5"
                              >
                                <X className="w-2.5 h-2.5 inline" /> {s}
                              </span>
                            ))}
                            {r.missingSkills.length === 0 && (
                              <span className="text-[10px] text-emerald-700">100%</span>
                            )}
                          </div>
                        </td>
                        <td className="text-right">
                          <ScoreBar score={r.score} />
                        </td>
                        <td className="text-[10px] text-midnight-500 whitespace-nowrap">
                          S {r.skillScore}/60<br />D {r.availabilityScore}/20<br />€ {r.rateScore}/10<br />◇ {r.seniorityScore}/10
                        </td>
                        <td>
                          <Link
                            href={
                              r.profile.kind === "user"
                                ? `/consultants/${r.profile.id}`
                                : `/candidates/${r.profile.id}`
                            }
                            className="text-indigoaccent hover:underline text-xs flex items-center gap-0.5"
                          >
                            Voir <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-sm text-midnight-500">
          Sélectionne une demande ou une mission ci-dessus pour lancer le matching.
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-midnight-400 tracking-wide">{label}</div>
      <div className="text-midnight-900">{value}</div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-sm font-semibold tabular-nums">{score}</span>
      <div className="w-16 h-1.5 bg-midnight-100 rounded overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}
