// Récap des tests techniques assignés à un candidat avec score et breakdown.
// Visible uniquement en mode admin (perm tests.manage). Pas de score affiché
// au candidat lui-même : ce composant n'est rendu que côté serveur via la
// fiche /candidates/[id] qui requiert déjà la perm consulting.read.

import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { getAssignmentsForCandidate, domainLabel, profileFromScores } from "@/server/actions/tests";
import { formatDate } from "@/lib/utils";

export async function CandidateTestsSection({ candidateId }: { candidateId: string }) {
  // Si la perm n'est pas accordée (consultant.read sans tests.manage), on
  // attrape silencieusement et on n'affiche rien plutôt que d'erreur.
  let assignments: Awaited<ReturnType<typeof getAssignmentsForCandidate>>;
  try {
    assignments = await getAssignmentsForCandidate(candidateId);
  } catch {
    return null;
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <GraduationCap className="w-4 h-4" /> Tests techniques ({assignments.length})
        </h2>
        <Link href="/tests" className="text-xs text-indigoaccent hover:underline inline-flex items-center gap-1">
          <Plus className="w-3 h-3" /> Assigner depuis /tests
        </Link>
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm text-midnight-500">
          Aucun test technique assigné pour ce candidat. Va sur <Link href="/tests" className="text-indigoaccent hover:underline">la page Tests</Link> pour en assigner un.
        </p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => {
            const sub = a.submission;
            const profile = sub?.completedAt ? profileFromScores(sub) : null;
            return (
              <li key={a.id} className="p-3 border border-border rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <Link href={`/tests/${a.test.id}`} className="font-medium text-midnight-900 hover:underline text-sm">
                      {a.test.title}
                    </Link>
                    <div className="text-[11px] text-midnight-500">
                      {domainLabel(a.test.domain)} · Assigné le {formatDate(a.assignedAt)}
                    </div>
                  </div>
                  <span className={
                    a.status === "COMPLETED" ? "badge-success"
                      : a.status === "EXPIRED" ? "badge-danger"
                      : a.status === "IN_PROGRESS" ? "badge-warning"
                      : "badge-neutral"
                  }>
                    {a.status === "COMPLETED" ? "Soumis"
                      : a.status === "EXPIRED" ? "Expiré"
                      : a.status === "IN_PROGRESS" ? "En cours"
                      : "En attente"}
                  </span>
                </div>
                {sub?.completedAt && (
                  <div className="mt-2 grid grid-cols-5 gap-2 text-xs">
                    <div className="text-center p-1.5 rounded bg-midnight-50">
                      <div className="font-semibold text-midnight-900">{sub.score}/{sub.maxScore}</div>
                      <div className="text-[9px] uppercase tracking-wider text-midnight-500">Total</div>
                    </div>
                    {(["scoreJunior", "scoreMedior", "scoreSenior", "scoreExpert"] as const).map((k, i) => {
                      const labels = ["Junior", "Médior", "Senior", "Expert"];
                      const maxKey = ["maxJunior", "maxMedior", "maxSenior", "maxExpert"][i] as
                        "maxJunior" | "maxMedior" | "maxSenior" | "maxExpert";
                      const sc = sub[k];
                      const mx = sub[maxKey];
                      const pct = mx > 0 ? sc / mx : 0;
                      const col = mx === 0 ? "text-midnight-300" : pct >= 0.7 ? "text-emerald-700" : pct >= 0.4 ? "text-amber-700" : "text-red-700";
                      return (
                        <div key={k} className="text-center p-1.5 rounded bg-midnight-50">
                          <div className={"font-semibold " + col}>
                            {mx > 0 ? `${sc}/${mx}` : "—"}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-midnight-500">{labels[i]}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {profile && (
                  <div className="mt-2 text-xs text-indigoaccent font-medium">
                    → {profile}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
