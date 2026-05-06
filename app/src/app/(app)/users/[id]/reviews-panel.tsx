"use client";
import { useTransition, useState } from "react";
import { createReview, updateReview, deleteReview } from "@/server/actions/consultant-reviews";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";

const KINDS = [
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "CHECK_IN", label: "Point régulier" },
  { value: "ANNUAL_REVIEW", label: "Entretien annuel" },
  { value: "END_OF_MISSION", label: "Fin de mission" },
  { value: "PERFORMANCE", label: "Performance" },
  { value: "CAREER", label: "Carrière" },
  { value: "OFFBOARDING", label: "Offboarding" },
  { value: "OTHER_REVIEW", label: "Autre" }
];

const OUTCOMES = [
  { value: "SCHEDULED", label: "Planifié", tone: "info" },
  { value: "COMPLETED", label: "Tenu", tone: "success" },
  { value: "CANCELLED", label: "Annulé", tone: "neutral" },
  { value: "RESCHEDULED", label: "Reprogrammé", tone: "warning" }
];

type Review = {
  id: string; scheduledAt: string; kind: string; outcome: string;
  feedback: string | null; privateNotes: string | null; goals: string | null;
  projectId: string | null; project: { id: string; reference: string; name: string } | null;
  conductedBy: { firstName: string; lastName: string } | null;
};
type Project = { id: string; reference: string; name: string };

export function ReviewsPanel({
  userId, reviews, projects, canManage, showPrivate
}: {
  userId: string;
  reviews: Review[];
  projects: Project[];
  canManage: boolean;
  showPrivate: boolean;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Entretiens internes ({reviews.length})</h2>
      </div>
      {reviews.length === 0 ? (
        <p className="text-sm text-midnight-500 mb-3">Aucun entretien interne enregistré.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {reviews.map(r => <ReviewRow key={r.id} review={r} projects={projects} canManage={canManage} showPrivate={showPrivate} />)}
        </div>
      )}
      {canManage && <NewReviewForm userId={userId} projects={projects} />}
    </section>
  );
}

function ReviewRow({ review, projects, canManage, showPrivate }: { review: Review; projects: Project[]; canManage: boolean; showPrivate: boolean }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const tone = OUTCOMES.find(o => o.value === review.outcome)?.tone ?? "neutral";
  return (
    <div className="border border-border rounded-lg">
      <div className="p-3 flex items-center gap-3">
        <button onClick={() => setOpen(o => !o)} className="text-midnight-500">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
        <div className="flex-1">
          <div className="text-sm font-medium">
            {KINDS.find(k => k.value === review.kind)?.label}
            {review.project && <span className="text-midnight-500 text-xs"> · {review.project.reference}</span>}
          </div>
          <div className="text-xs text-midnight-500">
            {formatDate(review.scheduledAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {review.conductedBy && <> · par {review.conductedBy.firstName} {review.conductedBy.lastName}</>}
          </div>
        </div>
        <span className={"badge-" + tone}>{OUTCOMES.find(o => o.value === review.outcome)?.label}</span>
        {canManage && (
          <>
            <button onClick={() => setEdit(true)} className="text-xs text-indigoaccent hover:underline">Éditer</button>
            <button
              disabled={pending}
              onClick={() => { if (window.confirm("Supprimer cet entretien ?")) start(async () => { try { await deleteReview(review.id); toast.success("Supprimé"); } catch (e: any) { toast.error(e.message); } }); }}
              className="text-danger hover:text-red-700"
            ><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      </div>
      {open && !edit && (
        <div className="border-t border-border p-3 bg-midnight-50/30 text-sm space-y-2">
          {review.feedback && <div><span className="text-midnight-500 text-xs">Feedback : </span>{review.feedback}</div>}
          {review.goals && <div><span className="text-midnight-500 text-xs">Objectifs : </span>{review.goals}</div>}
          {showPrivate && review.privateNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
              <div className="text-amber-800 font-medium mb-1">Notes privées (Admin/Manager)</div>
              <div className="text-amber-900">{review.privateNotes}</div>
            </div>
          )}
        </div>
      )}
      {open && edit && canManage && (
        <div className="border-t border-border p-3 bg-midnight-50/30">
          <ReviewEditForm review={review} projects={projects} onCancel={() => setEdit(false)} />
        </div>
      )}
    </div>
  );
}

function ReviewEditForm({ review, projects, onCancel }: { review: Review; projects: Project[]; onCancel: () => void }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        try { await updateReview(review.id, fd); onCancel(); toast.success("Mis à jour"); }
        catch (e: any) { toast.error(e.message); }
      })}
      className="grid grid-cols-12 gap-2"
    >
      <input type="hidden" name="subjectId" value={(review as any).subjectId ?? ""} />
      <input type="datetime-local" name="scheduledAt" defaultValue={new Date(review.scheduledAt).toISOString().slice(0, 16)} required className="input col-span-3" />
      <select name="kind" defaultValue={review.kind} className="input col-span-3">{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
      <select name="outcome" defaultValue={review.outcome} className="input col-span-2">{OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <select name="projectId" defaultValue={review.projectId ?? ""} className="input col-span-4">
        <option value="">— Pas de projet lié —</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>)}
      </select>
      <textarea name="feedback" defaultValue={review.feedback ?? ""} placeholder="Feedback (visible par le consultant)" className="input min-h-[60px] py-2 col-span-6" />
      <textarea name="goals" defaultValue={review.goals ?? ""} placeholder="Objectifs / actions" className="input min-h-[60px] py-2 col-span-6" />
      <textarea name="privateNotes" defaultValue={review.privateNotes ?? ""} placeholder="Notes privées (Admin/Manager uniquement)" className="input min-h-[60px] py-2 col-span-12" />
      <div className="col-span-12 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">Annuler</button>
        <button disabled={pending} className="btn-primary btn-sm">Enregistrer</button>
      </div>
    </form>
  );
}

function NewReviewForm({ userId, projects }: { userId: string; projects: Project[] }) {
  const [pending, start] = useTransition();
  const [extended, setExtended] = useState(false);
  return (
    <form
      action={(fd) => start(async () => {
        try { await createReview(fd); (document.getElementById(`new-rev-${userId}`) as HTMLFormElement)?.reset(); toast.success("Entretien planifié"); setExtended(false); }
        catch (e: any) { toast.error(e.message); }
      })}
      id={`new-rev-${userId}`}
      className="grid grid-cols-12 gap-2 items-end border-t border-border pt-3"
    >
      <input type="hidden" name="subjectId" value={userId} />
      <input type="datetime-local" name="scheduledAt" required className="input col-span-3" />
      <select name="kind" defaultValue="CHECK_IN" className="input col-span-3">{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
      <select name="outcome" defaultValue="SCHEDULED" className="input col-span-2">{OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      <select name="projectId" defaultValue="" className="input col-span-3">
        <option value="">— Pas de projet —</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>)}
      </select>
      <button disabled={pending} className="btn-primary col-span-1"><Plus className="w-4 h-4" /></button>
      {extended ? (
        <>
          <textarea name="feedback" placeholder="Feedback" className="input min-h-[50px] py-2 col-span-6" />
          <textarea name="goals" placeholder="Objectifs" className="input min-h-[50px] py-2 col-span-6" />
          <textarea name="privateNotes" placeholder="Notes privées" className="input min-h-[50px] py-2 col-span-12" />
        </>
      ) : (
        <button type="button" onClick={() => setExtended(true)} className="text-xs text-indigoaccent hover:underline col-span-12 text-left mt-1">+ Ajouter feedback / objectifs / notes privées</button>
      )}
    </form>
  );
}
