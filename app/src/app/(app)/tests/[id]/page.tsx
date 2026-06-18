import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { getTestDetail } from "@/server/actions/tests";
import { domainLabel, difficultyLabel, profileFromScores } from "@/lib/test-display";
import { AssignForm } from "./assign-form";
import { CopyTokenButton } from "./copy-token-button";
import { DeleteTestButton } from "./delete-test-button";
import { CheckCircle2, AlertCircle, Clock, GraduationCap } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TestDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("tests.manage");
  const test = await getTestDetail(params.id);
  if (!test) notFound();

  // Pour le form d'assignation : on liste les users actifs et candidats
  const [users, candidates] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.candidate.findMany({
      // Exclut les candidats archivés du sélecteur (ARCHIVED = sorti du pipeline)
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    })
  ]);

  const questionsByDifficulty = test.questions.reduce((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const scenarioCount = test.questions.filter((q) => q.isScenario).length;

  return (
    <div>
      <PageHeader
        title={test.title}
        subtitle={`${domainLabel(test.domain)} · ${test.questions.length} questions dont ${scenarioCount} mise${scenarioCount > 1 ? "s" : ""} en situation`}
        breadcrumb={[{ label: "Tests", href: "/tests" }, { label: test.title }]}
        actions={
          <div className="flex gap-2">
            <Link href={`/tests/${test.id}/edit`} className="btn-secondary">
              ✏️ Éditer les questions
            </Link>
            <DeleteTestButton testId={test.id} title={test.title} />
          </div>
        }
      />

      {test.description && (
        <p className="text-sm text-midnight-600 mb-6 max-w-3xl">{test.description}</p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne 1 : aperçu questions + breakdown */}
        <div className="lg:col-span-2 space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold mb-3">Répartition des questions</h2>
            <div className="grid grid-cols-4 gap-3">
              {(["JUNIOR", "MEDIOR", "SENIOR", "EXPERT"] as const).map((d) => (
                <div key={d} className="text-center p-3 rounded-lg bg-midnight-50">
                  <div className="text-2xl font-semibold text-midnight-900">
                    {questionsByDifficulty[d] ?? 0}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-midnight-500">
                    {difficultyLabel(d)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">Aperçu des questions</h2>
              <p className="text-xs text-midnight-500 mt-0.5">
                Les bonnes réponses ne sont pas visibles ici par sécurité (à modifier directement en base si besoin).
              </p>
            </div>
            <ol className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {test.questions.map((q) => (
                <li key={q.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-midnight-400 mt-0.5">{q.position}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-neutral text-[10px]">{difficultyLabel(q.difficulty)}</span>
                        {q.isScenario && (
                          <span className="badge-info text-[10px]">Cas pratique</span>
                        )}
                      </div>
                      <p className="text-sm text-midnight-900">{q.text}</p>
                      <ul className="mt-2 space-y-0.5">
                        {q.choices.map((c, i) => (
                          <li key={c.id} className="text-[12px] text-midnight-600">
                            {String.fromCharCode(65 + i)}) {c.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* Colonne 2 : formulaire d'assignation + liste assignations */}
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold mb-3">Assigner ce test</h2>
            <AssignForm
              testId={test.id}
              users={users.map((u) => ({
                id: u.id,
                label: `${u.firstName} ${u.lastName}${u.email ? " · " + u.email : ""}`
              }))}
              candidates={candidates.map((c) => ({
                id: c.id,
                label: `${c.firstName} ${c.lastName}${c.email ? " · " + c.email : ""}`
              }))}
            />
          </section>

          <section className="card overflow-hidden">
            <div className="p-5 border-b border-border">
              <h2 className="font-semibold">
                Assignations ({test.assignments.length})
              </h2>
            </div>
            {test.assignments.length === 0 ? (
              <p className="p-5 text-sm text-midnight-500">
                Aucune assignation pour le moment.
              </p>
            ) : (
              <ul className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {test.assignments.map((a) => {
                  const target = a.user
                    ? { name: `${a.user.firstName} ${a.user.lastName}`, type: "Consultant", href: `/users/${a.user.id}` }
                    : a.candidate
                      ? { name: `${a.candidate.firstName} ${a.candidate.lastName}`, type: "Candidat", href: `/candidates/${a.candidate.id}` }
                      : { name: "—", type: "?", href: "#" };
                  const status = a.status;
                  const statusInfo = {
                    PENDING:     { label: "En attente",  cls: "badge-neutral", icon: Clock },
                    IN_PROGRESS: { label: "En cours",    cls: "badge-warning", icon: Clock },
                    COMPLETED:   { label: "Soumis",      cls: "badge-success", icon: CheckCircle2 },
                    EXPIRED:     { label: "Expiré",      cls: "badge-danger",  icon: AlertCircle }
                  }[status];
                  const Icon = statusInfo.icon;
                  const profile = a.submission?.completedAt
                    ? profileFromScores(a.submission)
                    : null;
                  return (
                    <li key={a.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <Link href={target.href} className="font-medium text-midnight-900 hover:underline text-sm">
                            {target.name}
                          </Link>
                          <span className="text-[10px] text-midnight-400 ml-1">· {target.type}</span>
                        </div>
                        <span className={statusInfo.cls}>
                          <Icon className="w-3 h-3" /> {statusInfo.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-midnight-500">
                        Assigné le {formatDate(a.assignedAt)}
                        {a.expiresAt && <> · expire le {formatDate(a.expiresAt)}</>}
                      </div>
                      {/* Score visible uniquement admin + lien vers détail */}
                      {a.submission?.completedAt && (
                        <div className="mt-2 p-2 rounded bg-midnight-50 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              Score : {a.submission.score} / {a.submission.maxScore}
                            </span>
                            <span className="text-indigoaccent font-medium">{profile}</span>
                          </div>
                          <ScoreBreakdown s={a.submission} />
                          <Link
                            href={`/tests/submissions/${a.submission.id}`}
                            className="inline-block mt-1.5 text-[11px] text-indigoaccent hover:underline"
                          >
                            → Voir détail des réponses
                          </Link>
                        </div>
                      )}
                      {/* Lien magique pour candidat externe */}
                      {target.type === "Candidat" && (status === "PENDING" || status === "IN_PROGRESS") && (
                        <CopyTokenButton token={a.magicToken} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ScoreBreakdown({ s }: {
  s: {
    scoreJunior: number; maxJunior: number;
    scoreMedior: number; maxMedior: number;
    scoreSenior: number; maxSenior: number;
    scoreExpert: number; maxExpert: number;
  };
}) {
  const rows: [string, number, number][] = [
    ["Junior", s.scoreJunior, s.maxJunior],
    ["Médior", s.scoreMedior, s.maxMedior],
    ["Senior", s.scoreSenior, s.maxSenior],
    ["Expert", s.scoreExpert, s.maxExpert]
  ];
  return (
    <div className="grid grid-cols-4 gap-1 mt-1">
      {rows.map(([lbl, sc, mx]) => {
        const pct = mx > 0 ? sc / mx : 0;
        const col = mx === 0 ? "text-midnight-300" : pct >= 0.7 ? "text-emerald-700" : pct >= 0.4 ? "text-amber-700" : "text-red-700";
        return (
          <div key={lbl} className="text-center">
            <div className={`text-[11px] font-semibold ${col}`}>
              {mx > 0 ? `${sc}/${mx}` : "—"}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-midnight-500">{lbl}</div>
          </div>
        );
      })}
    </div>
  );
}
