"use client";
/**
 * Pipeline horizontal unifié « Consultants proposés » sur une demande de
 * mission (refonte du 2 juillet 2026).
 *
 * Une carte par consultant proposé (candidate ou consultant interne).
 * Chaque carte affiche 5 étapes visuelles cliquables :
 *
 *   ● Présenté ─── ● Entretien ─── ● Offre ─── ● Décision ─── ● Mission
 *   PRESENTED     INTERVIEWED*   OFFER_SENT   SELECTED /     ↑
 *                 SHORTLISTED                 REJECTED
 *
 * Actions inline selon l'étape courante — le user n'a jamais à jongler
 * entre plusieurs panneaux. La logique métier reste sur les server
 * actions existantes (setApplicationStatus, createMissionProposal, etc.).
 */
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  User as UserIcon, Users, FileDown, Send, Check, X, Loader2,
  ChevronRight, CircleCheck, Circle, Trash2, Plus, AlertCircle
} from "lucide-react";
import { setApplicationStatus, presentApplication, deleteApplication } from "@/server/actions/applications";
import {
  createMissionProposal, deleteMissionProposal, previewProposalTotals
} from "@/server/actions/mission-proposals";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  seniority: string | null;
  source: "candidate" | "consultant";
};

type ApplicationCard = {
  id: string;                            // MissionApplication.id
  status:
    | "PRESENTED" | "INTERVIEW_SCHEDULED" | "INTERVIEWED" | "SHORTLISTED"
    | "OFFER_SENT" | "SELECTED" | "REJECTED" | "WITHDRAWN";
  person: Person;
  proposedDailyRate: number | null;
  dailyCost: number | null;
  presentedAt: string;
  decisionAt: string | null;
  rejectedReason: string | null;
  interviewCount: number;
  missionId: string | null;
  missionReference: string | null;
  proposal: {
    id: string;
    reference: string;
    startDate: string;
    endDate: string;
    workDaysPerWeek: number;
    dailyRate: number;
    computedDays: number;
    computedBudgetHt: number;
  } | null;
};

type NewProfileOption =
  | { kind: "candidate"; id: string; firstName: string; lastName: string; seniority: string | null; dailyCost: number | null }
  | { kind: "consultant"; id: string; firstName: string; lastName: string; seniority: string | null; dailyCost: number | null };

// ──────────────────────────────────────────────────────────
// Stepper : suite des 5 étapes du pipeline avec état visuel
// ──────────────────────────────────────────────────────────
const STEPS = ["presented", "interview", "offer", "decision", "mission"] as const;
type Step = typeof STEPS[number];

function currentStep(app: ApplicationCard): Step {
  if (app.status === "SELECTED") return "mission";
  if (app.status === "REJECTED" || app.status === "WITHDRAWN") return "decision";
  if (app.status === "OFFER_SENT") return "offer";
  if (app.status === "INTERVIEW_SCHEDULED" || app.status === "INTERVIEWED" || app.status === "SHORTLISTED")
    return "interview";
  return "presented";
}

const STEP_META: Record<Step, { label: string }> = {
  presented: { label: "Présenté" },
  interview: { label: "Entretien" },
  offer:     { label: "Offre" },
  decision:  { label: "Décision" },
  mission:   { label: "Mission" }
};

export function MissionPipelinePanel({
  missionRequestId, defaults, applications, newProfileOptions
}: {
  missionRequestId: string;
  defaults: { startDate: string | null; endDate: string | null; dailyRate: number | null };
  applications: ApplicationCard[];
  newProfileOptions: NewProfileOption[];
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Consultants proposés ({applications.length})
          </h2>
          <p className="text-xs text-midnight-500 mt-1">
            Pipeline unifié : présentation, entretiens, offre PDF et décision — sur une seule ligne par consultant.
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary btn-sm">
            <Plus className="w-3 h-3" /> Proposer un consultant
          </button>
        )}
      </div>

      {adding && (
        <AddApplicationForm
          missionRequestId={missionRequestId}
          options={newProfileOptions}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}

      {applications.length === 0 && !adding && (
        <p className="text-sm text-midnight-500">
          Aucun consultant proposé pour le moment. Clique sur « Proposer un consultant » pour démarrer.
        </p>
      )}

      <ul className="space-y-3 mt-3">
        {applications.map((a) => (
          <PipelineCard key={a.id} app={a} defaults={defaults} />
        ))}
      </ul>
    </section>
  );
}

function AddApplicationForm({
  missionRequestId, options, onDone, onCancel
}: {
  missionRequestId: string;
  options: NewProfileOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    key: options[0] ? `${options[0].kind}:${options[0].id}` : "",
    proposedDailyRate: String(options[0]?.dailyCost ? options[0].dailyCost * 1.5 : "")
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.key) return toast.error("Choisis un profil");
    const [kind, id] = form.key.split(":");
    const fd = new FormData();
    fd.set("missionRequestId", missionRequestId);
    if (kind === "candidate") fd.set("candidateId", id);
    else fd.set("consultantId", id);
    if (form.proposedDailyRate) fd.set("proposedDailyRate", form.proposedDailyRate);
    start(async () => {
      try { await presentApplication(fd); toast.success("Profil ajouté"); onDone(); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <form onSubmit={submit} className="p-4 border-2 border-indigoaccent rounded-lg mb-3 space-y-3">
      <div>
        <label className="label">Profil à présenter</label>
        <select className="input" value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}>
          <optgroup label="Consultants internes">
            {options.filter((o) => o.kind === "consultant").map((o) => (
              <option key={`c:${o.id}`} value={`consultant:${o.id}`}>
                {o.firstName} {o.lastName}{o.seniority ? ` — ${o.seniority}` : ""}
                {o.dailyCost ? ` (coût ${o.dailyCost}€/j)` : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="Candidats externes">
            {options.filter((o) => o.kind === "candidate").map((o) => (
              <option key={`k:${o.id}`} value={`candidate:${o.id}`}>
                {o.firstName} {o.lastName}{o.seniority ? ` — ${o.seniority}` : ""}
                {o.dailyCost ? ` (coût ${o.dailyCost}€/j)` : ""}
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div>
        <label className="label">TJM à proposer au client (HTVA)</label>
        <input type="number" step="1" className="input" value={form.proposedDailyRate}
               onChange={(e) => setForm({ ...form, proposedDailyRate: e.target.value })}
               placeholder="Ex. 750" />
        <p className="text-[11px] text-midnight-500 mt-1">
          Peut être ajusté par la suite avant génération de l'offre PDF.
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">Annuler</button>
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Présenter
        </button>
      </div>
    </form>
  );
}

// ──────────────────────────────────────────────────────────
// Carte pipeline pour UNE application
// ──────────────────────────────────────────────────────────
function PipelineCard({
  app, defaults
}: {
  app: ApplicationCard;
  defaults: { startDate: string | null; endDate: string | null; dailyRate: number | null };
}) {
  const [pending, start] = useTransition();
  const [showOfferForm, setShowOfferForm] = useState(false);
  const step = currentStep(app);
  const p = app.person;
  const rejected = app.status === "REJECTED" || app.status === "WITHDRAWN";
  const doneStepIdx = STEPS.indexOf(step);

  function markInterviewed() {
    start(async () => {
      try { await setApplicationStatus(app.id, "INTERVIEWED"); toast.success("Entretien enregistré"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function markShortlisted() {
    start(async () => {
      try { await setApplicationStatus(app.id, "SHORTLISTED"); toast.success("Retenu"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function accept() {
    if (!confirm("Le client accepte l'offre ?\n\nCela crée automatiquement la Mission avec les dates et le TJM figés dans le PDF.")) return;
    start(async () => {
      try {
        await setApplicationStatus(app.id, "SELECTED");
        toast.success("Mission créée");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function reject() {
    const reason = prompt("Raison du refus (optionnel)") ?? undefined;
    start(async () => {
      try { await setApplicationStatus(app.id, "REJECTED", reason); toast.success("Marqué refusé"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function reopen() {
    start(async () => {
      try { await setApplicationStatus(app.id, "PRESENTED"); toast.success("Réouvert"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function removeCard() {
    if (!confirm(`Retirer ${p.firstName} ${p.lastName} de la demande ?`)) return;
    start(async () => {
      try { await deleteApplication(app.id); toast.success("Retiré"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function removeOffer() {
    if (!confirm("Supprimer l'offre PDF ? Le profil retombera en 'Présenté'.")) return;
    start(async () => {
      try { await deleteMissionProposal(app.proposal!.id); toast.success("Offre supprimée"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <li className={"border rounded-lg p-4 " + (rejected ? "border-red-200 bg-red-50/30 opacity-70" : "border-border")}>
      <div className="flex items-start gap-3">
        <PersonAvatar p={p} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium">
              <Link href={p.source === "consultant" ? `/users/${p.id}` : `/candidates/${p.id}`} className="hover:underline">
                {p.firstName} {p.lastName}
              </Link>
            </div>
            <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded " +
              (p.source === "consultant" ? "bg-indigoaccent/15 text-indigoaccent" : "bg-slate-100 text-slate-700")}>
              {p.source === "consultant" ? "Interne" : "Candidat"}
            </span>
            {p.seniority && <span className="text-xs text-midnight-500">{p.seniority}</span>}
            {app.missionReference && (
              <Link href={`/missions/${app.missionId}`} className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1">
                <CircleCheck className="w-3 h-3" /> Mission {app.missionReference}
              </Link>
            )}
          </div>

          {/* Stepper horizontal */}
          <div className="flex items-center gap-1 mt-3">
            {STEPS.map((s, i) => {
              const isDone = i < doneStepIdx || (i === doneStepIdx && step === "mission");
              const isCurrent = i === doneStepIdx && !isDone;
              const isRejectedAtDecision = rejected && s === "decision";
              return (
                <div key={s} className="flex items-center gap-1 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <CircleCheck className="w-4 h-4 text-emerald-600" />
                    ) : isCurrent ? (
                      <div className="w-4 h-4 rounded-full border-2 border-indigoaccent bg-indigoaccent/20" />
                    ) : isRejectedAtDecision ? (
                      <X className="w-4 h-4 text-red-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-midnight-300" />
                    )}
                    <span className={"text-xs " + (isDone || isCurrent ? "text-midnight-900 font-medium" : "text-midnight-400")}>
                      {STEP_META[s].label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-midnight-300 shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Bloc offre (si générée) */}
          {app.proposal && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-midnight-500">{app.proposal.reference}</span>
                <a
                  href={`/api/exports/proposal-pdf?id=${app.proposal.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-indigoaccent hover:underline inline-flex items-center gap-1"
                >
                  <FileDown className="w-3 h-3" /> Télécharger PDF
                </a>
              </div>
              <div className="text-midnight-700">
                {app.proposal.startDate} → {app.proposal.endDate} ·{" "}
                {app.proposal.workDaysPerWeek} j/sem · {app.proposal.computedDays} j ×{" "}
                {app.proposal.dailyRate.toFixed(0)} € ={" "}
                <strong className="text-midnight-900">{app.proposal.computedBudgetHt.toLocaleString("fr-BE", { style: "currency", currency: "EUR" })}</strong>
              </div>
            </div>
          )}

          {/* Raison rejet */}
          {rejected && app.rejectedReason && (
            <div className="mt-2 flex items-start gap-1 text-xs text-red-800">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{app.rejectedReason}</span>
            </div>
          )}

          {/* Actions contextuelles selon l'étape courante */}
          <div className="mt-3 flex flex-wrap gap-2">
            {step === "presented" && !rejected && (
              <>
                <button onClick={markInterviewed} disabled={pending} className="btn-ghost btn-sm">
                  Passer en entretien
                </button>
                <button onClick={() => setShowOfferForm(true)} disabled={pending} className="btn-primary btn-sm">
                  <Send className="w-3 h-3" /> Générer l'offre PDF
                </button>
                <button onClick={removeCard} disabled={pending} className="btn-ghost btn-sm text-red-600">
                  <Trash2 className="w-3 h-3" /> Retirer
                </button>
              </>
            )}
            {step === "interview" && !rejected && (
              <>
                <button onClick={markShortlisted} disabled={pending} className="btn-ghost btn-sm">
                  Retenir (shortlist)
                </button>
                <button onClick={() => setShowOfferForm(true)} disabled={pending} className="btn-primary btn-sm">
                  <Send className="w-3 h-3" /> Générer l'offre PDF
                </button>
                <button onClick={reject} disabled={pending} className="btn-ghost btn-sm text-red-600">
                  Refuser
                </button>
              </>
            )}
            {step === "offer" && !rejected && (
              <>
                <button onClick={accept} disabled={pending} className="btn-primary btn-sm bg-emerald-600 hover:bg-emerald-700">
                  {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Le client accepte
                </button>
                <button onClick={reject} disabled={pending} className="btn-ghost btn-sm text-red-600">
                  <X className="w-3 h-3" /> Le client refuse
                </button>
                <button onClick={removeOffer} disabled={pending} className="btn-ghost btn-sm">
                  <Trash2 className="w-3 h-3" /> Supprimer l'offre
                </button>
              </>
            )}
            {rejected && (
              <button onClick={reopen} disabled={pending} className="btn-ghost btn-sm">
                Rouvrir
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal offre (formulaire de génération) */}
      {showOfferForm && (
        <OfferForm
          applicationId={app.id}
          defaults={{
            startDate: defaults.startDate,
            endDate: defaults.endDate,
            dailyRate: app.proposedDailyRate ?? defaults.dailyRate
          }}
          onDone={() => setShowOfferForm(false)}
          onCancel={() => setShowOfferForm(false)}
        />
      )}
    </li>
  );
}

function PersonAvatar({ p }: { p: Person }) {
  if (p.photoUrl) {
    return <img src={p.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0">
      <UserIcon className="w-6 h-6" />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Formulaire offre (repris de proposals-panel, dépouillé)
// ──────────────────────────────────────────────────────────
function OfferForm({
  applicationId, defaults, onDone, onCancel
}: {
  applicationId: string;
  defaults: { startDate: string | null; endDate: string | null; dailyRate: number | null };
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    startDate: defaults.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: defaults.endDate ?? "",
    workDaysPerWeek: "5",
    includeHolidays: true,
    dailyRate: String(defaults.dailyRate ?? 0),
    intro: ""
  });
  const [preview, setPreview] = useState<{
    calendarDays: number; fullTimeWorkingDays: number;
    effectiveDays: number; budgetHt: number;
  } | null>(null);

  useEffect(() => {
    if (!form.startDate || !form.endDate) { setPreview(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await previewProposalTotals({
          startDate: form.startDate, endDate: form.endDate,
          workDaysPerWeek: Number(form.workDaysPerWeek || 5),
          includeHolidays: form.includeHolidays,
          dailyRate: Number(form.dailyRate || 0)
        });
        setPreview(r);
      } catch {}
    }, 150);
    return () => clearTimeout(t);
  }, [form.startDate, form.endDate, form.workDaysPerWeek, form.includeHolidays, form.dailyRate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.startDate || !form.endDate) return toast.error("Dates requises");
    if (!Number(form.dailyRate)) return toast.error("TJM requis");
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("startDate", form.startDate);
    fd.set("endDate", form.endDate);
    fd.set("workDaysPerWeek", form.workDaysPerWeek);
    if (form.includeHolidays) fd.set("includeHolidays", "on");
    fd.set("dailyRate", form.dailyRate);
    fd.set("intro", form.intro);
    start(async () => {
      try {
        const r = await createMissionProposal(fd);
        toast.success(`Offre ${r.reference} générée`);
        onDone();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onCancel}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl p-5 max-w-xl w-full shadow-lift max-h-[90vh] overflow-y-auto"
      >
        <h3 className="font-semibold text-lg mb-3">Générer l'offre PDF</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début *</label>
              <input type="date" className="input" value={form.startDate}
                     onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Fin *</label>
              <input type="date" className="input" value={form.endDate}
                     onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Régime (j/sem)</label>
              <input type="number" step="0.5" min="0.5" max="7" className="input"
                     value={form.workDaysPerWeek}
                     onChange={(e) => setForm({ ...form, workDaysPerWeek: e.target.value })} />
            </div>
            <div>
              <label className="label">TJM HTVA *</label>
              <input type="number" step="1" className="input" value={form.dailyRate}
                     onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.includeHolidays}
                   onChange={(e) => setForm({ ...form, includeHolidays: e.target.checked })} />
            Déduire les jours fériés belges
          </label>
          <div>
            <label className="label">Introduction (facultatif, sur le PDF)</label>
            <textarea className="input" rows={2} value={form.intro}
                      onChange={(e) => setForm({ ...form, intro: e.target.value })} />
          </div>

          {preview && (
            <div className="p-3 bg-slate-50 rounded-lg text-sm">
              <div className="flex justify-between"><span>Jours facturables</span><strong>{preview.effectiveDays} j</strong></div>
              <div className="flex justify-between text-base font-bold mt-1 pt-1 border-t">
                <span>Budget HTVA</span>
                <span>{preview.budgetHt.toLocaleString("fr-BE", { style: "currency", currency: "EUR" })}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="btn-ghost btn-sm">Annuler</button>
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Générer et envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
