"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronRight, Users } from "lucide-react";
import { addInterview, updateInterview, deleteInterview } from "@/server/actions/applications";
import { formatDate } from "@/lib/utils";

const KINDS = [
  { value: "PHONE",     label: "Téléphone" },
  { value: "VIDEO",     label: "Visio" },
  { value: "ON_SITE",   label: "Sur site" },
  { value: "TECHNICAL", label: "Technique" },
  { value: "HR",        label: "RH" }
];

const OUTCOMES = [
  { value: "PENDING",   label: "À tenir", tone: "warning" },
  { value: "PASSED",    label: "Réussi",  tone: "success" },
  { value: "FAILED",    label: "Échoué",  tone: "danger" },
  { value: "CANCELLED", label: "Annulé",  tone: "neutral" }
];

type Iv = {
  id: string;
  scheduledAt: string | Date;
  kind: string;
  interviewers: string | null;
  location: string | null;
  feedback: string | null;
  outcome: string;
};

export type AppWithInterviews = {
  applicationId: string;
  missionRequestId: string;
  missionRef: string;
  missionTitle: string;
  companyName: string;
  status: string;
  interviews: Iv[];
};

/**
 * Panneau "Entretiens chez le client" par candidat / consultant.
 * Une carte par MissionApplication : mission + client + liste ordonnée
 * des entretiens (round 1, 2, 3…) + bouton pour planifier un nouvel entretien.
 * Reflète le process client (plusieurs rounds).
 */
export function ClientInterviewsPanel({ applications }: { applications: AppWithInterviews[] }) {
  if (applications.length === 0) {
    return (
      <section className="card p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-2">
          <Users className="w-4 h-4" /> Entretiens client
        </h2>
        <p className="text-sm text-midnight-500">
          Aucune présentation client en cours. Présente d'abord ce profil sur une demande de mission depuis <Link href="/mission-requests" className="text-indigoaccent hover:underline">Demandes de mission</Link>.
        </p>
      </section>
    );
  }
  return (
    <section className="card p-5">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <Users className="w-4 h-4" /> Entretiens client ({applications.reduce((n, a) => n + a.interviews.length, 0)})
      </h2>
      <p className="text-xs text-midnight-500 mb-4">
        Un tour = un entretien. Ajoute une ligne à chaque étape du process client (screening RH, technique, décideur…).
      </p>
      <div className="space-y-3">
        {applications.map((a) => <ApplicationBlock key={a.applicationId} app={a} />)}
      </div>
    </section>
  );
}

function ApplicationBlock({ app }: { app: AppWithInterviews }) {
  const [open, setOpen] = useState(app.interviews.length === 0 || app.interviews.some(i => i.outcome === "PENDING"));
  const [showNew, setShowNew] = useState(false);
  const nextRound = app.interviews.length + 1;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-midnight-50/40 hover:bg-midnight-50 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-midnight-900">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Link href={`/mission-requests/${app.missionRequestId}`} className="hover:text-indigoaccent hover:underline">
              {app.missionRef}
            </Link>
            <span className="text-midnight-500 font-normal truncate">— {app.missionTitle}</span>
          </div>
          <div className="text-xs text-midnight-500 pl-5">
            {app.companyName} · {app.interviews.length} entretien{app.interviews.length > 1 ? "s" : ""}
          </div>
        </div>
      </button>
      {open && (
        <div className="p-3 space-y-2">
          {app.interviews.length === 0 && !showNew && (
            <p className="text-xs text-midnight-500 italic">Aucun entretien planifié pour ce client.</p>
          )}
          {app.interviews.map((iv, idx) => (
            <InterviewRow key={iv.id} iv={iv} round={idx + 1} />
          ))}
          {showNew ? (
            <NewForm
              applicationId={app.applicationId}
              round={nextRound}
              onDone={() => setShowNew(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="btn-secondary btn-sm w-full text-xs"
            >
              <Plus className="w-3 h-3" /> Planifier l'entretien #{nextRound}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewRow({ iv, round }: { iv: Iv; round: number }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const kindLabel = KINDS.find(k => k.value === iv.kind)?.label ?? iv.kind;
  const outcome = OUTCOMES.find(o => o.value === iv.outcome);

  if (edit) {
    return (
      <form
        action={(fd) => start(async () => {
          try {
            await updateInterview(iv.id, fd);
            setEdit(false);
            toast.success("Entretien mis à jour");
          } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
        })}
        className="grid grid-cols-12 gap-2 items-end p-2 bg-midnight-50/40 rounded"
      >
        <div className="col-span-3">
          <label className="label">Date</label>
          <input name="scheduledAt" type="datetime-local" required
            defaultValue={new Date(iv.scheduledAt).toISOString().slice(0, 16)} className="input text-xs" />
        </div>
        <div className="col-span-2">
          <label className="label">Type</label>
          <select name="kind" defaultValue={iv.kind} className="input text-xs">
            {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Interviewer(s)</label>
          <input name="interviewers" defaultValue={iv.interviewers ?? ""} className="input text-xs" />
        </div>
        <div className="col-span-2">
          <label className="label">Lieu / lien</label>
          <input name="location" defaultValue={iv.location ?? ""} className="input text-xs" />
        </div>
        <div className="col-span-2">
          <label className="label">Issue</label>
          <select name="outcome" defaultValue={iv.outcome} className="input text-xs">
            {OUTCOMES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="col-span-1 flex gap-1">
          <button disabled={pending} className="btn-primary btn-sm">OK</button>
          <button type="button" onClick={() => setEdit(false)} className="btn-ghost btn-sm">×</button>
        </div>
        <div className="col-span-12">
          <label className="label">Feedback</label>
          <input name="feedback" defaultValue={iv.feedback ?? ""} className="input text-xs" />
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-start gap-3 p-2 border border-border rounded text-sm">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigoaccent/10 text-indigoaccent grid place-items-center text-xs font-semibold">
        {round}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-midnight-900">
            {formatDate(iv.scheduledAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className="text-xs text-midnight-500">{kindLabel}</span>
          {outcome && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              outcome.tone === "success" ? "bg-emerald-50 text-emerald-700"
              : outcome.tone === "danger" ? "bg-red-50 text-red-700"
              : outcome.tone === "warning" ? "bg-amber-50 text-amber-700"
              : "bg-midnight-100 text-midnight-600"
            }`}>{outcome.label}</span>
          )}
        </div>
        {(iv.interviewers || iv.location) && (
          <div className="text-xs text-midnight-500 mt-0.5">
            {iv.interviewers && <>👥 {iv.interviewers}</>}
            {iv.interviewers && iv.location && " · "}
            {iv.location && <>📍 {iv.location}</>}
          </div>
        )}
        {iv.feedback && (
          <div className="text-xs text-midnight-700 mt-1 italic whitespace-pre-wrap">« {iv.feedback} »</div>
        )}
      </div>
      <div className="flex-shrink-0 flex gap-1 text-xs">
        <button onClick={() => setEdit(true)} className="text-indigoaccent hover:underline">Éditer</button>
        <button
          onClick={() => {
            if (!window.confirm("Supprimer cet entretien ?")) return;
            start(async () => {
              try {
                await deleteInterview(iv.id);
                toast.success("Entretien supprimé");
              } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
            });
          }}
          disabled={pending}
          className="text-red-600 hover:text-red-700"
          aria-label="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function NewForm({ applicationId, round, onDone }: { applicationId: string; round: number; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          await addInterview(applicationId, fd);
          toast.success(`Entretien #${round} planifié`);
          onDone();
        } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
      })}
      className="grid grid-cols-12 gap-2 items-end p-3 bg-indigoaccent/5 border border-indigoaccent/30 rounded"
    >
      <div className="col-span-12 text-xs font-medium text-indigoaccent">
        Nouvel entretien #{round}
      </div>
      <div className="col-span-3">
        <label className="label">Date & heure *</label>
        <input name="scheduledAt" type="datetime-local" required className="input text-xs" />
      </div>
      <div className="col-span-2">
        <label className="label">Type</label>
        <select name="kind" defaultValue="VIDEO" className="input text-xs">
          {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>
      <div className="col-span-3">
        <label className="label">Interviewer(s) côté client</label>
        <input name="interviewers" placeholder="ex: John (RH) + Nadia (Tech Lead)" className="input text-xs" />
      </div>
      <div className="col-span-3">
        <label className="label">Lieu / lien</label>
        <input name="location" placeholder="Teams / bureau client" className="input text-xs" />
      </div>
      <div className="col-span-1 flex gap-1">
        <button disabled={pending} className="btn-primary btn-sm w-full" title="Ajouter">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onDone} className="btn-ghost btn-sm">×</button>
      </div>
      <div className="col-span-12">
        <label className="label">Notes préparatoires</label>
        <input name="feedback" placeholder="Sujets à couvrir, questions à poser…" className="input text-xs" />
      </div>
    </form>
  );
}
