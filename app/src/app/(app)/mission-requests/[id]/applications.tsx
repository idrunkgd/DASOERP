"use client";
import { useTransition, useState } from "react";
import {
  presentCandidate, setApplicationStatus, deleteApplication,
  addInterview, updateInterview, deleteInterview, selectAndContractApplication
} from "@/server/actions/applications";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, Plus, ChevronDown, ChevronUp, ExternalLink, FileSignature } from "lucide-react";
import { CandidateAvatar } from "../../candidates/avatar";

type Cand = { id: string; firstName: string; lastName: string; seniority: string | null; dailyCost: number | null; status: string };
type Internal = { id: string; firstName: string; lastName: string; seniority: string | null; dailyCost: number | null };
type Iv = { id: string; scheduledAt: string; kind: string; interviewers: string | null; outcome: string; feedback: string | null };
type Person = { id: string; firstName: string; lastName: string; seniority: string | null; photoUrl?: string | null };
type App = {
  id: string; status: string;
  source: "candidate" | "consultant";
  person: Person;
  proposedDailyRate: number | null; dailyCost: number | null;
  presentedAt: string; decisionAt: string | null;
  rejectedReason: string | null; notes: string | null;
  missionId: string | null;
  interviews: Iv[];
};

// Pour la lecture (toutes les valeurs possibles, badges)
const APP_STATUS: { value: string; label: string; tone: string }[] = [
  { value: "PRESENTED", label: "Présenté", tone: "badge-info" },
  { value: "INTERVIEW_SCHEDULED", label: "Entretien planifié", tone: "badge-warning" },
  { value: "INTERVIEWED", label: "Entretien passé", tone: "badge-info" },
  { value: "SHORTLISTED", label: "Shortlisté", tone: "badge-warning" },
  { value: "SELECTED", label: "Sélectionné", tone: "badge-success" },
  { value: "REJECTED", label: "Refusé", tone: "badge-danger" },
  { value: "WITHDRAWN", label: "Retiré", tone: "badge-neutral" }
];
// Pour le dropdown : SELECTED retiré (passe par la modale "Contracter")
const APP_STATUS_EDIT = APP_STATUS.filter(s => s.value !== "SELECTED");

const KINDS = [
  { value: "PHONE", label: "Téléphone" },
  { value: "VIDEO", label: "Visio" },
  { value: "ON_SITE", label: "Sur site" },
  { value: "TECHNICAL", label: "Technique" },
  { value: "HR", label: "RH" }
];

export type RequestDefaults = {
  startDate: string | null;
  endDate: string | null;
  estimatedDays: number | null;
  targetDailyRate: number | null;
  workLocation: string | null;
};

export function ApplicationsPanel({
  missionId, applications, candidates, consultants, requestDefaults
}: {
  missionId: string;
  applications: App[];
  candidates: Cand[];
  consultants: Internal[];
  requestDefaults: RequestDefaults;
}) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Profils présentés ({applications.length})</h2>
      {applications.length === 0 ? (
        <p className="text-sm text-midnight-500 mb-3">Aucun profil présenté pour le moment.</p>
      ) : (
        <div className="space-y-3 mb-4">
          {applications.map(a => <ApplicationRow key={a.id} app={a} requestDefaults={requestDefaults} />)}
        </div>
      )}
      <PresentForm missionId={missionId} candidates={candidates} consultants={consultants} />
    </section>
  );
}

function ApplicationRow({ app, requestDefaults }: { app: App; requestDefaults: RequestDefaults }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [contractModal, setContractModal] = useState(false);
  const tone = APP_STATUS.find(s => s.value === app.status)?.tone ?? "badge-neutral";
  const statusLabel = APP_STATUS.find(s => s.value === app.status)?.label ?? app.status;
  const margin = (app.proposedDailyRate ?? 0) - (app.dailyCost ?? 0);
  const canContract = ["PRESENTED","INTERVIEW_SCHEDULED","INTERVIEWED","SHORTLISTED"].includes(app.status);

  return (
    <div className="border border-border rounded-lg">
      <div className="p-3 flex items-center gap-3">
        <button onClick={() => setOpen(o => !o)} className="text-midnight-500">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <CandidateAvatar
          firstName={app.person.firstName}
          lastName={app.person.lastName}
          photoUrl={app.person.photoUrl ?? null}
          size={40}
        />
        <div className="flex-1">
          <div className="font-medium flex items-center gap-2">
            {app.source === "consultant" ? (
              <a href={`/consultants/${app.person.id}`} className="hover:underline">{app.person.firstName} {app.person.lastName}</a>
            ) : (
              <a href={`/candidates/${app.person.id}`} className="hover:underline">{app.person.firstName} {app.person.lastName}</a>
            )}
            <span className={"text-[10px] px-1.5 py-0.5 rounded " + (app.source === "consultant" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
              {app.source === "consultant" ? "INTERNE" : "EXTERNE"}
            </span>
            {app.person.seniority && <span className="text-midnight-500 text-xs">· {app.person.seniority}</span>}
          </div>
          <div className="text-xs text-midnight-500">
            Présenté le {formatDate(app.presentedAt)} · {app.interviews.length} entretien(s)
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-midnight-500">Tarif proposé / cout / marge</div>
          <div className="text-sm tabular-nums">
            {app.proposedDailyRate ? formatCurrency(app.proposedDailyRate) : "—"}
            <span className="text-midnight-400"> / </span>
            {app.dailyCost ? formatCurrency(app.dailyCost) : "—"}
            <span className={"ml-2 " + (margin >= 0 ? "text-emerald-700" : "text-red-700")}>{formatCurrency(margin)}</span>
          </div>
        </div>
        <select
          defaultValue={app.status}
          disabled={pending || app.status === "SELECTED"}
          onChange={(e) => {
            const v = e.target.value as any;
            if (v === app.status) return;
            let reason: string | undefined;
            if (v === "REJECTED") { reason = window.prompt("Raison du refus :") ?? undefined; if (reason === undefined) { e.target.value = app.status; return; } }
            start(async () => { try { await setApplicationStatus(app.id, v, reason ?? null); toast.success("Statut mis à jour"); } catch (err: any) { toast.error(err.message); e.target.value = app.status; } });
          }}
          className="input h-8 text-xs py-0 w-[170px]"
        >
          {APP_STATUS_EDIT.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          {app.status === "SELECTED" && <option value="SELECTED">Sélectionné</option>}
        </select>
        <span className={tone}>{statusLabel}</span>
        {canContract && (
          <button
            onClick={() => setContractModal(true)}
            className="btn-primary btn-sm flex items-center gap-1"
            title="Sélectionner ce profil, créer la Mission T&M et contractualiser la demande"
          >
            <FileSignature className="w-3 h-3" /> Contracter
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => { if (window.confirm("Supprimer cette présentation ?")) start(async () => { await deleteApplication(app.id); }); }}
          className="text-danger hover:text-red-700"
        ><Trash2 className="w-4 h-4" /></button>
      </div>
      {open && (
        <div className="border-t border-border p-3 bg-midnight-50/30 space-y-3">
          {app.notes && <div className="text-sm"><span className="text-midnight-500">Notes : </span>{app.notes}</div>}
          {app.rejectedReason && <div className="text-sm text-red-700"><span className="text-midnight-500">Raison refus : </span>{app.rejectedReason}</div>}

          <div>
            <h4 className="text-xs uppercase font-semibold text-midnight-500 mb-2">Entretiens</h4>
            {app.interviews.length === 0 ? (
              <p className="text-sm text-midnight-500 mb-2">Aucun entretien planifié.</p>
            ) : (
              <table className="table-base mb-3">
                <thead><tr><th>Date</th><th>Type</th><th>Interviewer(s)</th><th>Outcome</th><th>Feedback</th><th></th></tr></thead>
                <tbody>
                  {app.interviews.map(i => (
                    <InterviewRow key={i.id} iv={i} />
                  ))}
                </tbody>
              </table>
            )}
            <NewInterview applicationId={app.id} />
          </div>

          {app.missionId && (
            <a href={`/missions/${app.missionId}`} className="btn-secondary btn-sm inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Voir la mission</a>
          )}
        </div>
      )}
      {contractModal && (
        <ContractModal
          app={app}
          requestDefaults={requestDefaults}
          onClose={() => setContractModal(false)}
        />
      )}
    </div>
  );
}

function ContractModal({ app, requestDefaults, onClose }: { app: App; requestDefaults: RequestDefaults; onClose: () => void }) {
  const [pending, start] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const defaultEnd = requestDefaults.endDate
    ?? (requestDefaults.startDate
      ? new Date(new Date(requestDefaults.startDate).getTime() + (requestDefaults.estimatedDays ?? 130) * 86400_000).toISOString().slice(0, 10)
      : new Date(Date.now() + (requestDefaults.estimatedDays ?? 130) * 86400_000).toISOString().slice(0, 10));
  const defaultRate = app.proposedDailyRate ?? requestDefaults.targetDailyRate ?? "";
  const defaultCost = app.dailyCost ?? "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={onClose}>
      <div className="card max-w-lg w-full p-6 m-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-1 flex items-center gap-2"><FileSignature className="w-4 h-4" /> Contracter la mission</h2>
        <p className="text-xs text-midnight-500 mb-4">
          Renseignez les conditions contractuelles pour <span className="font-medium">{app.person.firstName} {app.person.lastName}</span>.
          La demande passera en <span className="font-medium">CONTRACTED</span>, les autres présentations seront refusées et la <span className="font-medium">Mission T&M</span> sera créée.
        </p>
        <form
          action={(fd) => start(async () => {
            try { await selectAndContractApplication(app.id, fd); toast.success("Mission créée"); }
            catch (e: any) { toast.error(e.message); }
          })}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de début *</label>
              <input name="startDate" type="date" defaultValue={requestDefaults.startDate ?? today} required className="input" />
            </div>
            <div>
              <label className="label">Date de fin *</label>
              <input name="endDate" type="date" defaultValue={defaultEnd} required className="input" />
            </div>
            <div>
              <label className="label">Tarif facturé / j (€) *</label>
              <input name="dailyRate" type="number" step="0.01" defaultValue={String(defaultRate)} required className="input" />
            </div>
            <div>
              <label className="label">Coût / j (€) *</label>
              <input name="dailyCost" type="number" step="0.01" defaultValue={String(defaultCost)} required className="input" />
            </div>
            <div>
              <label className="label">Jours estimés</label>
              <input name="estimatedDays" type="number" defaultValue={requestDefaults.estimatedDays ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Localisation</label>
              <input name="workLocation" defaultValue={requestDefaults.workLocation ?? ""} className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
            <button disabled={pending} className="btn-primary">{pending ? "Création..." : "Contracter & créer la mission"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InterviewRow({ iv }: { iv: Iv }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  if (!edit) {
    return (
      <tr>
        <td>{formatDate(iv.scheduledAt, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
        <td className="text-xs">{KINDS.find(k => k.value === iv.kind)?.label}</td>
        <td className="text-xs">{iv.interviewers ?? "—"}</td>
        <td><span className={"badge-" + (iv.outcome === "PASSED" ? "success" : iv.outcome === "FAILED" ? "danger" : iv.outcome === "CANCELLED" ? "neutral" : "warning")}>{iv.outcome}</span></td>
        <td className="text-xs text-midnight-700 max-w-md truncate">{iv.feedback ?? "—"}</td>
        <td className="text-right whitespace-nowrap">
          <button onClick={() => setEdit(true)} className="text-xs text-indigoaccent hover:underline mr-2">Éditer</button>
          <button onClick={() => { if (window.confirm("Supprimer ?")) start(async () => { await deleteInterview(iv.id); }); }} className="text-danger"><Trash2 className="w-3 h-3 inline" /></button>
        </td>
      </tr>
    );
  }
  return (
    <tr className="bg-midnight-100/40">
      <td colSpan={6}>
        <form action={(fd) => start(async () => { try { await updateInterview(iv.id, fd); setEdit(false); toast.success("Entretien mis à jour"); } catch (e: any) { toast.error(e.message); } })}
          className="grid grid-cols-12 gap-2 items-end">
          <input name="scheduledAt" type="datetime-local" defaultValue={new Date(iv.scheduledAt).toISOString().slice(0, 16)} required className="input col-span-3" />
          <select name="kind" defaultValue={iv.kind} className="input col-span-2">{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <input name="interviewers" defaultValue={iv.interviewers ?? ""} placeholder="Interviewer(s)" className="input col-span-2" />
          <select name="outcome" defaultValue={iv.outcome} className="input col-span-1">
            <option value="PENDING">Pending</option><option value="PASSED">Passed</option><option value="FAILED">Failed</option><option value="CANCELLED">Cancelled</option>
          </select>
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

function NewInterview({ applicationId }: { applicationId: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => { try { await addInterview(applicationId, fd); (document.getElementById(`new-iv-${applicationId}`) as HTMLFormElement)?.reset(); toast.success("Entretien planifié"); } catch (e: any) { toast.error(e.message); } })}
      id={`new-iv-${applicationId}`}
      className="grid grid-cols-12 gap-2 items-end"
    >
      <input name="scheduledAt" type="datetime-local" required className="input col-span-3" />
      <select name="kind" defaultValue="VIDEO" className="input col-span-2">{KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
      <input name="interviewers" placeholder="Interviewer(s)" className="input col-span-3" />
      <input name="location" placeholder="Lieu / lien" className="input col-span-3" />
      <button disabled={pending} className="btn-primary col-span-1"><Plus className="w-4 h-4" /></button>
    </form>
  );
}

function PresentForm({ missionId, candidates, consultants }: { missionId: string; candidates: Cand[]; consultants: Internal[] }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => start(async () => { try { await presentCandidate(missionId, fd); (document.getElementById(`new-app-${missionId}`) as HTMLFormElement)?.reset(); toast.success("Profil présenté"); } catch (e: any) { toast.error(e.message); } })}
      id={`new-app-${missionId}`}
      className="grid grid-cols-12 gap-2 items-end border-t border-border pt-3"
    >
      <select name="subject" required className="input col-span-5">
        <option value="">— Choisir un profil à présenter —</option>
        <optgroup label="Candidats externes (vivier)">
          {candidates.map(c => (
            <option key={c.id} value={`C:${c.id}`}>
              {c.firstName} {c.lastName}{c.seniority ? ` (${c.seniority})` : ""}{c.status === "UNAVAILABLE" ? " — indispo" : ""}
            </option>
          ))}
        </optgroup>
        <optgroup label="Consultants Dasolabs (internes)">
          {consultants.map(u => (
            <option key={u.id} value={`U:${u.id}`}>
              {u.firstName} {u.lastName}{u.seniority ? ` (${u.seniority})` : ""}
            </option>
          ))}
        </optgroup>
      </select>
      <input name="proposedDailyRate" type="number" step="0.01" placeholder="Tarif proposé / j (€)" className="input col-span-3" />
      <input name="notes" placeholder="Notes" className="input col-span-3" />
      <button disabled={pending} className="btn-primary col-span-1"><Plus className="w-4 h-4" /></button>
    </form>
  );
}
