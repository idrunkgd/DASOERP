import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { rankMatches, type MatchableProfile, type MatchResult } from "@/lib/mission-matching";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Check, X, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MatchingPage({
  searchParams
}: {
  searchParams: { request?: string; includeCandidates?: string };
}) {
  await requireSession();

  // Demandes ouvertes
  const openRequests = await prisma.missionRequest.findMany({
    where: { status: { in: ["NEW", "QUALIFYING", "PRESENTING"] } },
    include: { company: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });

  const requestId = searchParams.request ?? openRequests[0]?.id;
  const includeCandidates = searchParams.includeCandidates !== "0";

  let results: MatchResult[] = [];
  let request: any = null;

  if (requestId) {
    request = await prisma.missionRequest.findUnique({
      where: { id: requestId },
      include: { company: { select: { name: true } } }
    });
    if (request) {
      // Profils : consultants Dasolabs (User CONSULTANT actifs) + optionnel candidats ACTIVE
      const [consultants, candidates] = await Promise.all([
        prisma.user.findMany({
          where: { active: true, role: "CONSULTANT" },
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
              where: { status: { in: ["ACTIVE"] } },
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
          requiredSkills: request.requiredSkills,
          seniority: request.seniority,
          startDate: request.startDate,
          targetDailyRate: request.targetDailyRate ? Number(request.targetDailyRate) : null,
          maxDailyRate: request.maxDailyRate ? Number(request.maxDailyRate) : null
        },
        profiles
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Matching mission ↔ profil"
        subtitle="Sélectionne une demande de mission et obtiens un classement automatique des consultants & candidats"
      />

      <form className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[300px]">
          <label className="label">Demande de mission</label>
          <select name="request" defaultValue={requestId} className="input">
            <option value="">— Sélectionner —</option>
            {openRequests.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reference} — {r.title} ({r.company.name})
              </option>
            ))}
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

      {request ? (
        <>
          <div className="card mb-4 p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Info label="Mission" value={`${request.reference} — ${request.title}`} />
              <Info label="Client" value={request.company.name} />
              <Info label="Skills requis" value={request.requiredSkills.join(", ") || "—"} />
              <Info label="Séniorité" value={request.seniority ?? "—"} />
              <Info label="Début" value={request.startDate ? formatDate(request.startDate) : "—"} />
              <Info
                label="TJM cible"
                value={
                  request.targetDailyRate
                    ? `${formatCurrency(Number(request.targetDailyRate))}${
                        request.maxDailyRate ? ` (max ${formatCurrency(Number(request.maxDailyRate))})` : ""
                      }`
                    : "—"
                }
              />
            </div>
          </div>

          {/* Résultats */}
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
          Sélectionne une demande de mission ci-dessus pour lancer le matching.
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
