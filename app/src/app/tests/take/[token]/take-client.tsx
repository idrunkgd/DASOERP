"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { saveAnswer, submitTest } from "@/server/actions/tests";

type Choice = { id: string; position: number; text: string };
type Question = {
  id: string;
  position: number;
  text: string;
  isScenario: boolean;
  choices: Choice[];
};

export function TakeTestClient({
  token,
  questions,
  initialAnswers
}: {
  token: string;
  questions: Question[];
  initialAnswers: Record<string, string>; // questionId → choiceId
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [submitting, startSubmit] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Record<string, "saving" | "saved" | "error">>({});

  function pick(questionId: string, choiceId: string) {
    setAnswers((a) => ({ ...a, [questionId]: choiceId }));
    setSaveStatus((s) => ({ ...s, [questionId]: "saving" }));
    saveAnswer({ token, questionId, choiceId })
      .then(() => setSaveStatus((s) => ({ ...s, [questionId]: "saved" })))
      .catch(() => setSaveStatus((s) => ({ ...s, [questionId]: "error" })));
  }

  function submit() {
    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      const ok = confirm(
        `${unanswered.length} question${unanswered.length > 1 ? "s sont non répondues" : " est non répondue"}. Soumettre quand même ?`
      );
      if (!ok) return;
    }
    startSubmit(async () => {
      try {
        await submitTest(token);
        setSubmitted(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur lors de la soumission");
      }
    });
  }

  if (submitted) {
    return (
      <div className="text-center py-10">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-midnight-900 mb-2">Merci !</h2>
        <p className="text-midnight-600 max-w-md mx-auto">
          Vos réponses ont été enregistrées et transmises à l'équipe Dasolabs. Nous reviendrons vers vous très prochainement.
        </p>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questions.length) * 100);

  return (
    <div>
      {/* Barre de progression */}
      <div className="sticky top-0 -mx-6 sm:-mx-10 px-6 sm:px-10 py-3 mb-6 bg-white/95 backdrop-blur border-b border-border z-10">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-midnight-700">
            {answeredCount} / {questions.length} questions répondues
          </span>
          <span className="text-midnight-500">{progress} %</span>
        </div>
        <div className="h-1.5 bg-midnight-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigoaccent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="space-y-6">
        {questions.map((q) => {
          const sel = answers[q.id];
          const status = saveStatus[q.id];
          return (
            <li key={q.id} className="border border-border rounded-lg p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-xs font-mono text-midnight-400 mt-0.5">
                  {q.position}.
                </span>
                <div className="flex-1">
                  {q.isScenario && (
                    <span className="badge-info text-[10px] mb-1.5 inline-block">
                      Mise en situation
                    </span>
                  )}
                  <p className="text-sm text-midnight-900 leading-relaxed">{q.text}</p>
                </div>
                {status === "saving" && (
                  <Loader2 className="w-3 h-3 text-midnight-400 animate-spin" />
                )}
                {status === "saved" && (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                )}
              </div>
              <ul className="space-y-1.5 pl-7">
                {q.choices.map((c, i) => (
                  <li key={c.id}>
                    <label
                      className={
                        "flex items-start gap-2.5 p-2.5 rounded-md cursor-pointer transition-colors " +
                        (sel === c.id
                          ? "bg-indigoaccent/10 border border-indigoaccent"
                          : "border border-transparent hover:bg-midnight-50")
                      }
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={sel === c.id}
                        onChange={() => pick(q.id, c.id)}
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        <span className="font-medium text-midnight-700 mr-2">
                          {String.fromCharCode(65 + i)})
                        </span>
                        {c.text}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <div className="mt-8 pt-6 border-t border-border flex items-center justify-between gap-4">
        <p className="text-xs text-midnight-500">
          Vos réponses sont enregistrées au fur et à mesure. Cliquez sur Soumettre quand vous avez terminé.
        </p>
        <button
          onClick={submit}
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Soumettre mes réponses
        </button>
      </div>
    </div>
  );
}
