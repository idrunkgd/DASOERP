import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { getSubmissionDetail } from "@/server/actions/tests";
import { domainLabel, difficultyLabel, profileFromScores } from "@/lib/test-display";
import { CheckCircle2, XCircle, MinusCircle, AlertCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  await requirePermission("tests.manage");
  const detail = await getSubmissionDetail(params.id);
  if (!detail) notFound();

  const { submission, questions, snapshotted, test, person, personType } = detail;
  const personName = person ? `${person.firstName} ${person.lastName}` : "—";
  const personHref = person ? (personType === "user" ? `/users/${person.id}` : `/candidates/${person.id}`) : "#";
  const profile = submission.completedAt ? profileFromScores(submission) : null;

  const answeredCount = questions.filter((q) => q.isAnswered).length;
  const correctCount = questions.filter((q) => q.isCorrect).length;
  const wrongCount = questions.filter((q) => q.isAnswered && !q.isCorrect).length;
  const skippedCount = questions.length - answeredCount;

  return (
    <div>
      <PageHeader
        title={`Résultat — ${personName}`}
        subtitle={`${test.title} · ${domainLabel(test.domain)} · soumis le ${submission.completedAt ? formatDate(submission.completedAt) : "—"}`}
        breadcrumb={[
          { label: "Tests", href: "/tests" },
          { label: test.title, href: `/tests/${test.id}` },
          { label: personName }
        ]}
      />

      {/* Score d'ensemble + breakdown */}
      <section className="card p-5 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
          <div className="p-3 rounded-lg bg-midnight-50 text-center">
            <div className="text-3xl font-semibold text-midnight-900">{submission.score}<span className="text-base text-midnight-500">/{submission.maxScore}</span></div>
            <div className="text-[10px] uppercase tracking-wider text-midnight-500 mt-0.5">Score global</div>
          </div>
          {(["Junior", "Médior", "Senior", "Expert"] as const).map((lbl, i) => {
            const key = `score${lbl === "Médior" ? "Medior" : lbl}` as keyof typeof submission;
            const mxKey = `max${lbl === "Médior" ? "Medior" : lbl}` as keyof typeof submission;
            const sc = submission[key] as number;
            const mx = submission[mxKey] as number;
            const pct = mx > 0 ? sc / mx : 0;
            const col = mx === 0 ? "text-midnight-300" : pct >= 0.7 ? "text-emerald-700" : pct >= 0.4 ? "text-amber-700" : "text-red-700";
            return (
              <div key={lbl} className="p-3 rounded-lg bg-midnight-50 text-center">
                <div className={"text-2xl font-semibold " + col}>{mx > 0 ? `${sc}/${mx}` : "—"}</div>
                <div className="text-[10px] uppercase tracking-wider text-midnight-500 mt-0.5">{lbl}</div>
              </div>
            );
          })}
        </div>
        {profile && (
          <div className="text-sm text-indigoaccent font-medium">→ Profil déduit : {profile}</div>
        )}
        <div className="mt-2 text-xs text-midnight-500 flex gap-4 flex-wrap">
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-600" /> {correctCount} correctes</span>
          <span className="inline-flex items-center gap-1"><XCircle className="w-3 h-3 text-red-600" /> {wrongCount} fausses</span>
          {skippedCount > 0 && (
            <span className="inline-flex items-center gap-1"><MinusCircle className="w-3 h-3 text-midnight-400" /> {skippedCount} sans réponse</span>
          )}
          <Link href={personHref} className="text-indigoaccent hover:underline">→ Voir la fiche {personType === "candidate" ? "candidat" : "consultant"}</Link>
        </div>
        {!snapshotted && (
          <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Aucun snapshot disponible pour cette submission (datée d'avant la mise en place du système de figeage). Les questions affichées sont la version actuelle — si tu as édité depuis, le rendu peut différer de ce que le candidat a réellement vu.
            </span>
          </div>
        )}
      </section>

      {/* Liste des questions avec réponses */}
      <ol className="space-y-3">
        {questions.map((q) => {
          const isCorrect = q.isCorrect;
          const isAnswered = q.isAnswered;
          const borderCls = !isAnswered
            ? "border-midnight-200"
            : isCorrect
              ? "border-emerald-300 bg-emerald-50/30"
              : "border-red-300 bg-red-50/30";
          return (
            <li key={q.id} className={"card border " + borderCls}>
              <div className="p-4">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xs font-mono text-midnight-500 mt-0.5">{q.position}.</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-neutral text-[10px]">{difficultyLabel(q.difficulty)}</span>
                      {q.isScenario && <span className="badge-info text-[10px]">Cas pratique</span>}
                      {!isAnswered && <span className="badge-neutral text-[10px]">Non répondue</span>}
                      {isAnswered && (
                        isCorrect ? (
                          <span className="badge-success text-[10px] inline-flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> Bonne réponse
                          </span>
                        ) : (
                          <span className="badge-danger text-[10px] inline-flex items-center gap-0.5">
                            <XCircle className="w-3 h-3" /> Mauvaise réponse
                          </span>
                        )
                      )}
                    </div>
                    <p className="text-sm text-midnight-900">{q.text}</p>
                  </div>
                </div>
                <ul className="space-y-1.5 ml-7">
                  {q.choices.map((c, i) => {
                    const isSelected = c.id === q.selectedChoiceId;
                    const isRight = c.isCorrect;
                    let cls = "p-2 rounded text-sm border ";
                    if (isSelected && isRight) cls += "border-emerald-400 bg-emerald-100 text-emerald-900";
                    else if (isSelected && !isRight) cls += "border-red-400 bg-red-100 text-red-900";
                    else if (isRight) cls += "border-emerald-300 bg-emerald-50 text-emerald-900";
                    else cls += "border-midnight-100 text-midnight-700";
                    return (
                      <li key={c.id} className={cls}>
                        <span className="font-medium mr-2">{String.fromCharCode(65 + i)})</span>
                        {c.text}
                        {isSelected && isRight && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider">
                            ← Réponse du candidat ✓
                          </span>
                        )}
                        {isSelected && !isRight && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider">
                            ← Réponse du candidat ✗
                          </span>
                        )}
                        {!isSelected && isRight && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider">
                            ← Bonne réponse
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
