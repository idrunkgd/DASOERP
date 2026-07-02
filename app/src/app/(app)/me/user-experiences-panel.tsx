"use client";
/**
 * Panneau d'édition des expériences pro d'un consultant interne (User).
 * Copie adaptée de experiences-panel.tsx (candidate) — les deux tables sont
 * distinctes pour garder les cascades delete simples.
 */
import { useState, useTransition } from "react";
import {
  addUserExperience, updateUserExperience, deleteUserExperience
} from "@/server/actions/user-experiences";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Briefcase, Loader2, Save } from "lucide-react";

type Exp = {
  id: string;
  companyName: string;
  jobTitle: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

export function UserExperiencesPanel({
  userId, experiences
}: { userId: string; experiences: Exp[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Briefcase className="w-4 h-4" /> Expériences professionnelles ({experiences.length})
        </h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
            <Plus className="w-4 h-4" /> Ajouter
          </button>
        )}
      </div>

      {adding && <ExpForm userId={userId} onDone={() => setAdding(false)} />}

      {experiences.length === 0 && !adding && (
        <p className="text-sm text-midnight-500 mt-3">
          Aucune expérience renseignée. Ces expériences seront reprises sur
          les propositions PDF envoyées au client quand ce consultant est
          proposé sur une mission.
        </p>
      )}

      <div className="mt-4 space-y-3">
        {experiences.map((e) => <ExpRow key={e.id} userId={userId} exp={e} />)}
      </div>
    </section>
  );
}

function ExpRow({ userId, exp }: { userId: string; exp: Exp }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  if (edit) return <ExpForm userId={userId} initial={exp} onDone={() => setEdit(false)} />;
  const ongoing = !exp.endDate;
  return (
    <div className="border-l-2 border-indigoaccent/40 pl-4 py-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-midnight-900">
            {exp.jobTitle && (
              <span>
                {exp.jobTitle} <span className="text-midnight-500 font-normal">·</span>{" "}
              </span>
            )}
            <span className="text-indigoaccent">{exp.companyName}</span>
          </div>
          <div className="text-xs text-midnight-500">
            {formatDate(exp.startDate, { month: "short", year: "numeric" })}
            {" — "}
            {ongoing ? (
              <span className="text-emerald-700 font-medium">en cours</span>
            ) : (
              formatDate(exp.endDate as string, { month: "short", year: "numeric" })
            )}
          </div>
          {exp.description && (
            <p className="text-sm text-midnight-700 mt-1 whitespace-pre-wrap">{exp.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEdit(true)} className="text-midnight-500 hover:text-midnight-900"
            title="Éditer"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Supprimer l'expérience chez ${exp.companyName} ?`)) return;
              start(async () => {
                try { await deleteUserExperience(exp.id); toast.success("Supprimée"); }
                catch (e: any) { toast.error(e.message); }
              });
            }}
            className="text-midnight-500 hover:text-danger" title="Supprimer"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExpForm({
  userId, initial, onDone
}: { userId: string; initial?: Exp; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [ongoing, setOngoing] = useState(initial ? !initial.endDate : false);
  return (
    <form
      action={(fd) => start(async () => {
        try {
          fd.set("userId", userId);
          if (ongoing) fd.set("endDate", "");
          if (initial) await updateUserExperience(initial.id, fd);
          else await addUserExperience(fd);
          toast.success(initial ? "Modifiée" : "Ajoutée");
          onDone();
        } catch (e: any) { toast.error(e.message); }
      })}
      className="border border-indigoaccent/40 rounded-lg p-4 space-y-2 mb-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="jobTitle" placeholder="Poste (Ing. logiciel...)"
               defaultValue={initial?.jobTitle ?? ""} className="input" />
        <input name="companyName" placeholder="Entreprise *" required
               defaultValue={initial?.companyName ?? ""} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Début *</label>
          <input type="date" name="startDate" required
                 defaultValue={initial?.startDate ? initial.startDate.slice(0, 10) : ""}
                 className="input" />
        </div>
        <div>
          <label className="label">Fin</label>
          <input type="date" name="endDate" disabled={ongoing}
                 defaultValue={initial?.endDate ? initial.endDate.slice(0, 10) : ""}
                 className="input" />
          <label className="flex items-center gap-2 text-xs mt-1">
            <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
            Poste en cours
          </label>
        </div>
      </div>
      <textarea name="description" rows={3} placeholder="Description / missions"
                defaultValue={initial?.description ?? ""} className="input" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn-ghost btn-sm">Annuler</button>
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          {initial ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}
