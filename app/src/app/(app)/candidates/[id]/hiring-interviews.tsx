"use client";
import { useState, useTransition } from "react";
import { addCandidateInterview, updateCandidateInterview, deleteInterview } from "@/server/actions/applications";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, Plus, CalendarPlus } from "lucide-react";

const KINDS = [
  { value: "HR",        label: "RH" },
  { value: "PHONE",     label: "Téléphone" },
  { value: "VIDEO",     label: "Visio" },
  { value: "ON_SITE",   label: "Sur site" },
  { value: "TECHNICAL", label: "Technique" }
];

const OUTCOMES = [
  { value: "PENDING",   label: "À tenir", tone: "warning" },
  { value: "PASSED",    label: "Réussi",  tone: "success" },
  { value: "FAILED",    label: "Échoué",  tone: "danger" },
  { value: "CANCELLED", label: "Annulé",  tone: "neutral" }
];

type Iv = {
  id: string; scheduledAt: string; kind: string;
  interviewers: string | null; location: string | null;
  feedback: string | null; outcome: string;
};

export function HiringInterviewsPanel({ candidateId, interviews }: { candidateId: string; interviews: Iv[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2"><CalendarPlus className="w-4 h-4" /> Entretiens d'embauche Dasolabs ({interviews.length})</h2>
        <button onClick={() => setOpen(o => !o)} className="btn-secondary btn-sm">{open ? "Fermer" : "+ Planifier"}</button>
      </div>
      <p className="text-xs text-midnight-500 mb-3">Ces entretiens concernent le recrutement chez Dasolabs (≠ entretiens de placement client).</p>
      {open && <NewForm candidateId={candidateId} onDone={() => setOpen(false)} />}
      {interviews.length === 0 ? (
        <p className="text-sm text-midnight-500 mt-3">Aucun entretien planifié.</p>
      ) : (
        <table className="table-base mt-3">
          <thead><tr><th>Date</th><th>Type</th><th>Interviewer(s)</th><th>Lieu / lien</th><th>Issue</th><th>Feedback</th><th></th></tr></thead>
          <tbody>
            {interviews.map(i => <Row key={i.id} iv={i} />)}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Row({ iv }: { iv: Iv }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  if (!edit) {
    const tone = OUTCOMES.find(o => o.value === iv.outcome)?.tone ?? "neutral";
    return (
      <tr>
        <td>{formatDate(iv.scheduledAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
        <td className="text-xs">{KINDS.find(k => k.value === iv.kind)?.label ?? iv.kind}</td>
        <td className="text-xs text-midnight-700">{iv.interviewers ?? "—"}</td>
        <td className="text-xs text-midnight-700">{iv.location ?? "—"}</td>
        <td><span className={"badge-" + tone}>{OUTCOMES.find(o => o.value === iv.outcome)?.label}</span></td>
        <td className="text-xs text-midnight-700 max-w-md whitespace-pre-wrap">{iv.feedback ?? "—"}</td>
        <td className="text-right whitespace-nowrap">
          <button onClick={() => setEdit(true)} className="text-xs text-indigoaccent hover:underline mr-2">Éditer</button>
          <button onClick={() => { if (window.confirm("Supprimer ?")) start(async () => { await deleteInterview(iv.id); }); }} className="text-danger"><Trash2 className="w-3 h-3 inline" /></button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="bg-midnight-50/40">
      <td colSpan={7}>
        <form action={(fd) => start(async () => { try { await updateCandidateInterview(iv.id, fd); setEdit(false); toast.success("Mis à jour"); } catch (e: any) { toast.error(e.message); } })}
          className="grid grid-cols-12 gap-2 items-end">
          <input name="scheduledAt" type="datetime-local" defaultValue={new Date(iv.scheduledAt).toISOString().slice(0,16)} required className="input col-span-3" />
          <select name="kind" defaultValue={iv.kind} className="input col-span-2">{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <input name="interviewers" defaultValue={iv.interviewers ?? ""} placeholder="Interviewer(s)" className="input col-span-2" />
          <select name="outcome" defaultValue={iv.outcome} className="input col-span-1">{OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          <input name="feedback" defaultValue={iv.feedback ?? ""} placeholder="Feedback" className="input col-span-3" />
          <div className="col-span-1 flex gap-1">
            <button disabled={pending} className="btn-primary btn-sm">OK</button>
            <button type="button" onClick={() => setEdit(false)} className="btn-ghost btn-sm">×</button>
          </div>
        </form>
      </td>
    </tr>
  );
}

function NewForm({ candidateId, onDone }: { candidateId: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        try { await addCandidateInterview(candidateId, fd); onDone(); toast.success("Entretien planifié"); }
        catch (e: any) { toast.error(e.message); }
      })}
      className="grid grid-cols-12 gap-2 items-end border border-border rounded-lg p-3 bg-midnight-50/30"
    >
      <div className="col-span-3"><label className="label">Date & heure *</label><input name="scheduledAt" type="datetime-local" required className="input" /></div>
      <div className="col-span-2"><label className="label">Type</label><select name="kind" defaultValue="HR" className="input">{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
      <div className="col-span-3"><label className="label">Interviewer(s)</label><input name="interviewers" placeholder="ex: Sophie + Karim" className="input" /></div>
      <div className="col-span-3"><label className="label">Lieu / lien</label><input name="location" placeholder="ex: Bureau / lien Teams" className="input" /></div>
      <div className="col-span-1"><button disabled={pending} className="btn-primary w-full"><Plus className="w-4 h-4" /></button></div>
      <div className="col-span-12"><label className="label">Notes / agenda</label><input name="feedback" placeholder="Notes préalables ou feedback ultérieur" className="input" /></div>
    </form>
  );
}
