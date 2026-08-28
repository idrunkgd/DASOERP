"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCw } from "lucide-react";
import { saveQuizAttempt } from "@/server/actions/training";
import { isNextControlFlow } from "@/lib/next-errors";

export interface QuizQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
}

export function QuizRunner({
  slideId,
  questions
}: {
  slideId: string;
  questions: QuizQuestion[];
}) {
  const [choices, setChoices] = useState<Record<number, number>>({});
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);
  const [pending, start] = useTransition();

  function selectOption(qIdx: number, oIdx: number) {
    if (result) return;
    setChoices((c) => ({ ...c, [qIdx]: oIdx }));
  }

  function submit() {
    const missing = questions.some((_, i) => choices[i] === undefined);
    if (missing) { toast.error("Réponds à toutes les questions avant de valider."); return; }
    const arr = questions.map((_, i) => choices[i]);
    start(async () => {
      try {
        const r = await saveQuizAttempt(slideId, arr);
        setResult({ score: r.score, total: r.total });
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function retake() {
    setChoices({});
    setResult(null);
  }

  const percent = result ? Math.round((result.score / result.total) * 100) : 0;
  const passed = result && percent >= 60;

  return (
    <div className="space-y-6">
      {result && (
        <div className={`card p-5 ${passed ? "bg-emerald-50/50 border-emerald-200" : "bg-rose-50/50 border-rose-200"}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
              {passed ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg">{result.score} / {result.total} bonnes réponses ({percent}%)</div>
              <div className="text-sm text-midnight-600">
                {passed ? "Bravo — tu peux passer à la suite. Relis les réponses correctes ci-dessous." : "Score insuffisant — reprends les explications puis retente le quiz."}
              </div>
            </div>
            <button onClick={retake} className="btn-secondary btn-sm text-xs">
              <RotateCw className="w-3.5 h-3.5" /> Recommencer
            </button>
          </div>
        </div>
      )}

      {questions.map((q, qIdx) => {
        const chosen = choices[qIdx];
        return (
          <div key={qIdx} className="card p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-7 h-7 rounded-full bg-indigoaccent text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                {qIdx + 1}
              </div>
              <h3 className="font-semibold text-sm text-midnight-900 pt-0.5">{q.prompt}</h3>
            </div>
            <div className="space-y-2 pl-10">
              {q.options.map((opt, oIdx) => {
                const selected = chosen === oIdx;
                const showResult = !!result;
                const isCorrect = oIdx === q.correctIndex;
                const cls = showResult
                  ? isCorrect
                    ? "border-emerald-400 bg-emerald-50"
                    : selected
                      ? "border-rose-400 bg-rose-50"
                      : "border-border bg-white"
                  : selected
                    ? "border-indigoaccent bg-indigoaccent/5"
                    : "border-border bg-white hover:border-indigoaccent/50";
                return (
                  <button
                    key={oIdx}
                    type="button"
                    disabled={!!result}
                    onClick={() => selectOption(qIdx, oIdx)}
                    className={"w-full text-left p-3 rounded-lg border text-sm transition-colors flex items-start gap-3 " + cls}
                  >
                    <div className={"w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[10px] font-bold " + (
                      showResult
                        ? isCorrect
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : selected
                            ? "border-rose-500 bg-rose-500 text-white"
                            : "border-midnight-300 text-midnight-500"
                        : selected
                          ? "border-indigoaccent bg-indigoaccent text-white"
                          : "border-midnight-300 text-midnight-500"
                    )}>
                      {String.fromCharCode(65 + oIdx)}
                    </div>
                    <span className="flex-1">{opt}</span>
                    {showResult && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                    {showResult && !isCorrect && selected && <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {!result && (
        <div className="flex justify-end">
          <button onClick={submit} disabled={pending} className="btn-primary">
            {pending ? "Validation…" : "Valider mes réponses"}
          </button>
        </div>
      )}
    </div>
  );
}
