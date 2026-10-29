"use client";
/**
 * Pipeline recrutement candidat — 6 étapes checklist avec notes.
 * Style inspiré de l'onboarding : bullet-point + case à cocher + notes.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Edit3, Save, X, Loader2 } from "lucide-react";
import {
  toggleRecruitmentStage, updateRecruitmentStageNotes
} from "@/server/actions/candidate-recruitment-stages";

type Stage = { stageKey: string; done: boolean; doneAt: string | null; notes: string | null };

const STAGES: { key: string; label: string; description: string }[] = [
  { key: "QUALIFICATION",  label: "Qualification",     description: "Screening initial, call découverte, validation du profil et des attentes" },
  { key: "CV_SENT",        label: "Envoi CV",          description: "CV présenté au client avec commentaire commercial" },
  { key: "TECH_INTERVIEW", label: "Entretien technique", description: "Validation technique avec expert / lead du client" },
  { key: "CLIENT_MEETING", label: "Rencontre client",  description: "Rencontre finale avec le manager côté client" },
  { key: "OFFER",          label: "Offre",             description: "Proposition envoyée / négociée / acceptée" },
  { key: "PLACEMENT",      label: "Placement",         description: "Démarrage effectif de la mission" }
];

export function RecruitmentPipeline({
  candidateId, stages, canManage
}: {
  candidateId: string;
  stages: Stage[];
  canManage: boolean;
}) {
  const stageMap = new Map(stages.map((s) => [s.stageKey, s]));
  const doneCount = STAGES.filter((s) => stageMap.get(s.key)?.done).length;

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Pipeline recrutement</h2>
        <div className="text-xs text-midnight-500">
          <span className="font-semibold text-indigoaccent">{doneCount}</span> / {STAGES.length} étapes complétées
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full bg-midnight-100 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-indigoaccent transition-all"
          style={{ width: `${(doneCount / STAGES.length) * 100}%` }}
        />
      </div>

      <ol className="space-y-3">
        {STAGES.map((s, idx) => {
          const row = stageMap.get(s.key);
          return (
            <StageRow
              key={s.key}
              candidateId={candidateId}
              stageDef={s}
              index={idx + 1}
              stage={row ?? null}
              canManage={canManage}
            />
          );
        })}
      </ol>
    </section>
  );
}

function StageRow({
  candidateId, stageDef, index, stage, canManage
}: {
  candidateId: string;
  stageDef: { key: string; label: string; description: string };
  index: number;
  stage: Stage | null;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(stage?.notes ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();

  const done = stage?.done ?? false;

  function toggle() {
    if (!canManage) return;
    start(async () => {
      try {
        await toggleRecruitmentStage(candidateId, stageDef.key, !done);
        router.refresh();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  function saveNotes() {
    start(async () => {
      try {
        await updateRecruitmentStageNotes(candidateId, stageDef.key, notes);
        toast.success("Notes enregistrées");
        setEditing(false);
        router.refresh();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <li className={
      "border rounded-lg p-3 transition-all " +
      (done ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-white")
    }>
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={!canManage || pending}
          className="mt-0.5 shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
          title={done ? "Décocher" : "Marquer comme fait"}
        >
          {done ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          ) : (
            <Circle className="w-6 h-6 text-midnight-300" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={"text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded " + (done ? "bg-emerald-100 text-emerald-700" : "bg-midnight-100 text-midnight-500")}>
              {String(index).padStart(2, "0")}
            </span>
            <h3 className={"font-semibold " + (done ? "text-emerald-900 line-through decoration-emerald-400" : "text-midnight-900")}>
              {stageDef.label}
            </h3>
            {stage?.doneAt && (
              <span className="text-[11px] text-midnight-500">
                · fait le {new Date(stage.doneAt).toLocaleDateString("fr-BE")}
              </span>
            )}
          </div>
          <p className="text-xs text-midnight-500 mt-0.5">{stageDef.description}</p>

          {/* Notes */}
          <div className="mt-2">
            {editing ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Compte-rendu, feedback, contexte…"
                  className="input min-h-[70px] py-2 text-sm w-full"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setEditing(false); setNotes(stage?.notes ?? ""); }} className="btn-ghost btn-sm" disabled={pending}>
                    <X className="w-3 h-3" /> Annuler
                  </button>
                  <button onClick={saveNotes} className="btn-primary btn-sm" disabled={pending}>
                    {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Enregistrer
                  </button>
                </div>
              </div>
            ) : stage?.notes ? (
              <div className="bg-white rounded border border-border/60 p-2 text-sm text-midnight-700 whitespace-pre-wrap group">
                {stage.notes}
                {canManage && (
                  <button onClick={() => setEditing(true)} className="ml-2 inline-flex items-center text-indigoaccent hover:underline text-xs">
                    <Edit3 className="w-3 h-3" /> modifier
                  </button>
                )}
              </div>
            ) : canManage ? (
              <button onClick={() => setEditing(true)} className="text-xs text-indigoaccent hover:underline inline-flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Ajouter des notes
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
