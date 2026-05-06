"use client";
import { useState, useTransition } from "react";
import { addExperience, updateExperience, deleteExperience } from "@/server/actions/candidate-experiences";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2, Edit3, Briefcase } from "lucide-react";

type Exp = {
  id: string;
  companyName: string;
  jobTitle: string | null;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

export function ExperiencesPanel({ candidateId, experiences }: { candidateId: string; experiences: Exp[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <section className="card p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2"><Briefcase className="w-4 h-4" /> Expériences professionnelles ({experiences.length})</h2>
        {!adding && <button onClick={() => setAdding(true)} className="btn-primary btn-sm"><Plus className="w-4 h-4" /> Ajouter</button>}
      </div>

      {adding && <ExpForm candidateId={candidateId} onDone={() => setAdding(false)} />}

      {experiences.length === 0 && !adding && (
        <p className="text-sm text-midnight-500 mt-3">Aucune expérience renseignée. Ajoutez vos postes précédents pour valoriser votre CV.</p>
      )}

      <div className="mt-4 space-y-3">
        {experiences.map(e => <ExpRow key={e.id} candidateId={candidateId} exp={e} />)}
      </div>
    </section>
  );
}

function ExpRow({ candidateId, exp }: { candidateId: string; exp: Exp }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  if (edit) return <ExpForm candidateId={candidateId} initial={exp} onDone={() => setEdit(false)} />;
  const ongoing = !exp.endDate;
  return (
    <div className="border-l-2 border-indigoaccent/40 pl-4 py-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-midnight-900">
            {exp.jobTitle ? <span>{exp.jobTitle} <span className="text-midnight-500 font-normal">·</span> </span> : null}
            <span className="text-indigoaccent">{exp.companyName}</span>
          </div>
          <div className="text-xs text-midnight-500">
            {formatDate(exp.startDate, { month: "short", year: "numeric" })}
            {" — "}
            {ongoing ? <span className="text-emerald-700 font-medium">en cours</span> : formatDate(exp.endDate as string, { month: "short", year: "numeric" })}
          </div>
          {exp.description && <p className="text-sm text-midnight-700 mt-1 whitespace-pre-wrap">{exp.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEdit(true)} className="text-midnight-500 hover:text-midnight-900" title="Éditer"><Edit3 className="w-4 h-4" /></button>
          <button
            disabled={pending}
            onClick={() => { if (window.confirm(`Supprimer l'expérience chez ${exp.companyName} ?`)) start(async () => { try { await deleteExperience(exp.id); toast.success("Supprimée"); } catch (e: any) { toast.error(e.message); } }); }}
            className="text-midnight-500 hover:text-danger" title="Supprimer"
          ><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function ExpForm({ candidateId, initial, onDone }: { candidateId: string; initial?: Exp; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [ongoing, setOngoing] = useState(initial ? !initial.endDate : false);
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (ongoing) fd.set("endDate", "");
          if (initial) await updateExperience(initial.id, fd);
          else await addExperience(fd);
          toast.success(initial ? "Expérience mise à jour" : "Expérience ajoutée");
          onDone();
        } catch (e: any) { toast.error(e.message); }
      })}
      className="border border-border rounded-lg p-4 bg-midnight-50/30 space-y-3"
    >
      <input type="hidden" name="candidateId" value={candidateId} />
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-7"><label className="label">Entreprise *</label><input name="companyName" defaultValue={initial?.companyName ?? ""} required className="input" placeholder="ex: ACME Industries" /></div>
        <div className="col-span-5"><label className="label">Intitulé du poste</label><input name="jobTitle" defaultValue={initial?.jobTitle ?? ""} className="input" placeholder="ex: Senior Backend Engineer" /></div>
        <div className="col-span-4"><label className="label">Date de début *</label><input name="startDate" type="date" defaultValue={initial?.startDate ? initial.startDate.slice(0,10) : ""} required className="input" /></div>
        <div className="col-span-4">
          <label className="label">Date de fin</label>
          <input name="endDate" type="date" defaultValue={initial?.endDate ? initial.endDate.slice(0,10) : ""} className="input" disabled={ongoing} />
        </div>
        <div className="col-span-4 flex items-end">
          <label className="flex items-center gap-2 text-sm text-midnight-700 cursor-pointer">
            <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} />
            Poste en cours
          </label>
        </div>
        <div className="col-span-12">
          <label className="label">Description / réalisations</label>
          <textarea name="description" defaultValue={initial?.description ?? ""} rows={4} className="input py-2" placeholder="Décrivez les missions, les technologies, les résultats obtenus..." />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn-ghost">Annuler</button>
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </form>
  );
}
