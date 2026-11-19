"use client";
import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Send, ArrowRight } from "lucide-react";
import { saveAnswer, submitTest } from "@/server/actions/tests";

type Choice = { id: string; position: number; text: string };
type Question = {
  id: string;
  position: number;
  text: string;
  isScenario: boolean;
  choices: Choice[];
};

/**
 * Mode "une question à la fois" : le candidat ne voit QUE la question courante,
 * aucun accès aux suivantes, aucun retour en arrière possible une fois une
 * question dépassée. On démarre sur la première question non répondue
 * (reprise après rechargement).
 */
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
  const [saving, startSave] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  // Index de départ : première question non répondue (reprise de session)
  const initialIdx = useMemo(() => {
    const i = questions.findIndex((q) => !initialAnswers[q.id]);
    return i === -1 ? questions.length - 1 : i;
  }, [questions, initialAnswers]);
  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  // Sélection locale (pas encore enregistrée) pour la question courante.
  // Volontairement non pré-remplie depuis `answers` : on n'affiche jamais la
  // réponse précédente d'une question déjà passée.
  const [picked, setPicked] = useState<string | null>(null);

  const current = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;

  function goNext() {
    if (!current || !picked) return;
    const qid = current.id;
    const choiceId = picked;
    // Enregistre le choix côté serveur, puis avance. Si le save plante, on
    // bloque l'avancée pour ne pas perdre la réponse.
    startSave(async () => {
      try {
        await saveAnswer({ token, questionId: qid, choiceId });
        setAnswers((a) => ({ ...a, [qid]: choiceId }));
        if (!isLast) {
          setCurrentIdx((i) => i + 1);
          setPicked(null);
        } else {
          // Dernière question : on soumet directement
          doSubmit();
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur lors de l'enregistrement — réessaie.");
      }
    });
  }

  function doSubmit() {
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

  if (!current) {
    return <p className="text-sm text-midnight-500">Aucune question dans ce test.</p>;
  }

  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / questions.length) * 100);
  const busy = saving || submitting;

  return (
    <div>
      {/* Barre de progression */}
      <div className="sticky top-0 -mx-6 sm:-mx-10 px-6 sm:px-10 py-3 mb-8 bg-white/95 backdrop-blur border-b border-border z-10">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-medium text-midnight-700">
            Question {currentIdx + 1} / {questions.length}
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

      {/* Question courante — rendue avec key={id} pour forcer le reset du DOM
          entre deux questions (évite tout leak d'état radio React). */}
      <div key={current.id} className="border border-border rounded-lg p-5 sm:p-6 bg-white">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-xs font-mono text-midnight-400 mt-1">
            {current.position}.
          </span>
          <div className="flex-1">
            {current.isScenario && (
              <span className="badge-info text-[10px] mb-2 inline-block">
                Mise en situation
              </span>
            )}
            <p className="text-base text-midnight-900 leading-relaxed">
              {current.text}
            </p>
          </div>
        </div>
        <ul className="space-y-2 pl-7">
          {current.choices.map((c, i) => (
            <li key={c.id}>
              <label
                className={
                  "flex items-start gap-3 p-3 rounded-md cursor-pointer transition-colors border " +
                  (picked === c.id
                    ? "bg-indigoaccent/10 border-indigoaccent"
                    : "border-transparent hover:bg-midnight-50")
                }
              >
                <input
                  type="radio"
                  name={current.id}
                  checked={picked === c.id}
                  onChange={() => setPicked(c.id)}
                  disabled={busy}
                  className="mt-1"
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
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-xs text-midnight-500">
          Une fois validée, vous ne pourrez plus revenir en arrière.
        </p>
        <button
          onClick={goNext}
          disabled={!picked || busy}
          className="btn-primary"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isLast ? (
            <Send className="w-4 h-4" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          {isLast ? "Valider et soumettre" : "Valider et passer à la suivante"}
        </button>
      </div>
    </div>
  );
}
