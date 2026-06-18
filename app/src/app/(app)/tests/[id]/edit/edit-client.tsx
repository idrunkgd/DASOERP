"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Save, Loader2, Pencil, Check, X } from "lucide-react";
import { updateQuestion } from "@/server/actions/tests";

type Choice = { id: string; position: number; text: string; isCorrect: boolean };
type Question = {
  id: string;
  position: number;
  text: string;
  difficulty: "JUNIOR" | "MEDIOR" | "SENIOR" | "EXPERT";
  isScenario: boolean;
  points: number;
  choices: Choice[];
};

export function EditQuestionsClient({ questions: initial }: { questions: Question[] }) {
  const [questions, setQuestions] = useState<Question[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <ol className="space-y-3">
      {questions.map((q) => (
        <QuestionEditor
          key={q.id}
          question={q}
          isEditing={editingId === q.id}
          onEdit={() => setEditingId(q.id)}
          onCancel={() => setEditingId(null)}
          onSaved={(updated) => {
            setQuestions((qs) => qs.map((x) => (x.id === updated.id ? updated : x)));
            setEditingId(null);
          }}
        />
      ))}
    </ol>
  );
}

function QuestionEditor({
  question,
  isEditing,
  onEdit,
  onCancel,
  onSaved
}: {
  question: Question;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: (q: Question) => void;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Question>(question);

  function reset() {
    setDraft(question);
    onCancel();
  }

  function save() {
    const correctCount = draft.choices.filter((c) => c.isCorrect).length;
    if (correctCount !== 1) {
      toast.error("Exactement une bonne réponse doit être marquée");
      return;
    }
    if (!draft.text.trim() || draft.choices.some((c) => !c.text.trim())) {
      toast.error("Texte de question et de chaque choix obligatoires");
      return;
    }
    start(async () => {
      try {
        await updateQuestion({
          questionId: draft.id,
          text: draft.text,
          difficulty: draft.difficulty,
          isScenario: draft.isScenario,
          points: draft.points,
          choices: draft.choices.map((c) => ({
            id: c.id,
            text: c.text,
            isCorrect: c.isCorrect
          }))
        });
        toast.success(`Question ${draft.position} mise à jour`);
        onSaved(draft);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!isEditing) {
    const correct = question.choices.find((c) => c.isCorrect);
    return (
      <li className="card p-4">
        <div className="flex items-start gap-3">
          <span className="text-xs font-mono text-midnight-400 mt-0.5">{question.position}.</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-neutral text-[10px]">{question.difficulty}</span>
              {question.isScenario && <span className="badge-info text-[10px]">Cas pratique</span>}
              {question.points !== 1 && <span className="badge-warning text-[10px]">{question.points} pts</span>}
            </div>
            <p className="text-sm text-midnight-900">{question.text}</p>
            <p className="text-xs text-emerald-700 mt-1.5">
              ✓ Bonne réponse : {String.fromCharCode(65 + (question.choices.findIndex((c) => c.isCorrect)))} — {correct?.text}
            </p>
          </div>
          <button onClick={onEdit} className="btn-secondary btn-sm">
            <Pencil className="w-3 h-3" /> Modifier
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="card p-4 border-2 border-indigoaccent">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-midnight-500">Question {question.position}</span>
        <div className="flex gap-2">
          <button onClick={reset} disabled={pending} className="btn-ghost btn-sm">
            <X className="w-3 h-3" /> Annuler
          </button>
          <button onClick={save} disabled={pending} className="btn-primary btn-sm">
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Enregistrer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Difficulté</label>
          <select
            value={draft.difficulty}
            onChange={(e) => setDraft({ ...draft, difficulty: e.target.value as Question["difficulty"] })}
            className="input"
          >
            <option value="JUNIOR">Junior</option>
            <option value="MEDIOR">Médior</option>
            <option value="SENIOR">Senior</option>
            <option value="EXPERT">Expert</option>
          </select>
        </div>
        <div>
          <label className="label">Points</label>
          <input
            type="number"
            min={1}
            max={10}
            value={draft.points}
            onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) || 1 })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Cas pratique ?</label>
          <label className="flex items-center gap-2 h-10">
            <input
              type="checkbox"
              checked={draft.isScenario}
              onChange={(e) => setDraft({ ...draft, isScenario: e.target.checked })}
            />
            <span className="text-sm text-midnight-700">Mise en situation</span>
          </label>
        </div>
      </div>

      <div className="mb-3">
        <label className="label">Énoncé</label>
        <textarea
          value={draft.text}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          rows={3}
          className="input min-h-[80px]"
        />
      </div>

      <div>
        <label className="label">Choix (coche la bonne réponse)</label>
        <ul className="space-y-2">
          {draft.choices.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2">
              <span className="font-medium w-6">{String.fromCharCode(65 + i)})</span>
              <input
                type="radio"
                name={`correct-${draft.id}`}
                checked={c.isCorrect}
                onChange={() => setDraft({
                  ...draft,
                  choices: draft.choices.map((x) => ({ ...x, isCorrect: x.id === c.id }))
                })}
              />
              <input
                type="text"
                value={c.text}
                onChange={(e) => setDraft({
                  ...draft,
                  choices: draft.choices.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x)
                })}
                className="input flex-1"
              />
              {c.isCorrect && <Check className="w-4 h-4 text-emerald-600" />}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-midnight-500 mt-2">
          La bonne réponse apparaît en vert dans le tableau et compte pour le score des candidats.
        </p>
      </div>
    </li>
  );
}
