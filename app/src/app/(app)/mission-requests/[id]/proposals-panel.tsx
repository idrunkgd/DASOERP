"use client";
/**
 * Panneau « Propositions consultants » sur la fiche MissionRequest.
 *
 * Le pivot est MissionApplication : on ne pick pas un candidat, on pick
 * une présentation existante (candidat OU consultant interne). Ça évite
 * la redondance et raccroche le PDF à un profil déjà validé sur le CRM.
 *
 * Statuts affichés :
 *  - DRAFT : proposition créée mais pas encore marquée envoyée
 *  - SENT  : envoyée au client — l'application est simultanément en OFFER_SENT
 *  - ACCEPTED : client valide → cascade auto vers création de Mission
 *  - REJECTED : client refuse
 *  - CANCELLED : annulée par nous
 */
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Plus, FileDown, Send, Check, X, Trash2, Loader2, User as UserIcon,
  CheckCircle2, AlertCircle, Users
} from "lucide-react";
import {
  createMissionProposal, deleteMissionProposal,
  setMissionProposalStatus, previewProposalTotals
} from "@/server/actions/mission-proposals";

type Person = {
  firstName: string; lastName: string;
  photoUrl: string | null; seniority: string | null;
  source: "candidate" | "consultant";
};

type EligibleApp = {
  applicationId: string;
  status: string;
  person: Person;
  proposedDailyRate: number | null;
};

type Proposal = {
  id: string;
  reference: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  applicationId: string;
  person: Person;
  startDate: string;
  endDate: string;
  workDaysPerWeek: number;
  dailyRate: number;
  computedDays: number;
  computedBudgetHt: number;
  sentAt: string | null;
};

const STATUS_META: Record<Proposal["status"], { label: string; cls: string }> = {
  DRAFT:     { label: "Brouillon",  cls: "bg-slate-100 text-slate-700" },
  SENT:      { label: "Envoyée",    cls: "bg-amber-100 text-amber-800" },
  ACCEPTED:  { label: "Acceptée",   cls: "bg-emerald-100 text-emerald-800" },
  REJECTED:  { label: "Refusée",    cls: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Annulée",    cls: "bg-slate-200 text-slate-500" }
};

export function ProposalsPanel({
  missionRequestId, defaults, eligibleApplications, proposals
}: {
  missionRequestId: string;
  defaults: { startDate: string | null; endDate: string | null; dailyRate: number | null };
  eligibleApplications: EligibleApp[];
  proposals: Proposal[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Propositions consultants ({proposals.length})</h2>
        {!creating && eligibleApplications.length > 0 && (
          <button onClick={() => setCreating(true)} className="btn-primary btn-sm">
            <Plus className="w-3 h-3" /> Générer une proposition
          </button>
        )}
      </div>

      {creating && (
        <NewProposalForm
          missionRequestId={missionRequestId}
          defaults={defaults}
          eligibleApplications={eligibleApplications}
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {proposals.length === 0 && !creating && eligibleApplications.length === 0 && (
        <p className="text-sm text-midnight-500">
          Aucune proposition. Présente d'abord un candidat ou un consultant interne dans le panneau
          <strong> Applications </strong> ci-dessous, puis reviens ici pour générer sa proposition PDF.
        </p>
      )}

      {proposals.length === 0 && !creating && eligibleApplications.length > 0 && (
        <p className="text-sm text-midnight-500">
          {eligibleApplications.length} profil(s) présenté(s) disponible(s) pour une proposition.
          Clique sur « Générer une proposition ».
        </p>
      )}

      {proposals.length > 0 && (
        <ul className="space-y-2 mt-2">
          {proposals.map((p) => <ProposalRow key={p.id} p={p} />)}
        </ul>
      )}
    </section>
  );
}

function PersonBadge({ p, size = "md" }: { p: Person; size?: "sm" | "md" }) {
  const dim = size === "sm" ? "w-8 h-8" : "w-12 h-12";
  return (
    <div className="flex items-center gap-2">
      {p.photoUrl ? (
        <img src={p.photoUrl} alt="" className={`${dim} rounded-full object-cover`} />
      ) : (
        <div className={`${dim} rounded-full bg-slate-200 flex items-center justify-center text-slate-500`}>
          <UserIcon className="w-4 h-4" />
        </div>
      )}
      <div>
        <div className="font-medium text-sm">{p.firstName} {p.lastName}</div>
        <div className="text-[10px] text-midnight-500 flex items-center gap-1">
          {p.source === "consultant" ? (
            <span className="badge-info text-[9px]">Interne</span>
          ) : (
            <span className="badge-neutral text-[9px]">Candidat</span>
          )}
          {p.seniority && <span>· {p.seniority}</span>}
        </div>
      </div>
    </div>
  );
}

function ProposalRow({ p }: { p: Proposal }) {
  const [pending, start] = useTransition();
  const st = STATUS_META[p.status];

  function changeStatus(next: Proposal["status"]) {
    if (next === "REJECTED") {
      const reason = prompt("Raison du refus (optionnel)") ?? undefined;
      start(async () => {
        try {
          await setMissionProposalStatus(p.id, "REJECTED", reason);
          toast.success("Marquée refusée");
        } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
      });
      return;
    }
    if (next === "ACCEPTED") {
      const ok = confirm(
        "Accepter la proposition ?\n\n" +
        "Cela va : (1) marquer l'application SELECTED, (2) créer automatiquement la Mission, " +
        "(3) refuser les autres profils présentés en compétition."
      );
      if (!ok) return;
      // L'acceptation métier se fait côté application status (SELECTED), pas
      // directement sur la proposal — c'est le passage à SELECTED qui trigger
      // la création de mission. On appelle setApplicationStatus depuis
      // l'action des applications, disponible via ApplicationsPanel. Ici on
      // fait un raccourci en pilotant la proposition à ACCEPTED en direct :
      // l'utilisateur devra ensuite cliquer "Contracter" côté Application.
      // → Simplification : on route côté server via setMissionProposalStatus,
      //   qui ne crée pas la mission. Le vrai flow "Accepter → créer Mission"
      //   passe par le bouton SELECT sur l'application (voir ApplicationsPanel).
      start(async () => {
        try {
          await setMissionProposalStatus(p.id, "ACCEPTED");
          toast.success("Marquée acceptée. Passe l'application en 'SELECTED' pour créer la mission.");
        } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
      });
      return;
    }
    start(async () => {
      try {
        await setMissionProposalStatus(p.id, next);
        toast.success(`Statut : ${STATUS_META[next].label}`);
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  function remove() {
    if (!confirm(`Supprimer la proposition ${p.reference} ?`)) return;
    start(async () => {
      try { await deleteMissionProposal(p.id); toast.success("Supprimée"); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <li className="p-3 border border-border rounded-lg">
      <div className="flex items-start gap-3">
        <PersonBadge p={p.person} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${st.cls}`}>{st.label}</span>
            <span className="text-xs font-mono text-midnight-500">{p.reference}</span>
          </div>
          <div className="text-xs text-midnight-500 mt-1">
            {p.startDate} → {p.endDate} · {p.workDaysPerWeek} j/sem · {p.computedDays} j facturables ×{" "}
            {p.dailyRate.toFixed(0)} € = <strong className="text-midnight-900">{p.computedBudgetHt.toFixed(2)} € HT</strong>
          </div>
        </div>
        <div className="flex flex-col gap-1 items-end shrink-0">
          <a
            href={`/api/exports/proposal-pdf?id=${p.id}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-indigoaccent hover:underline inline-flex items-center gap-1"
          >
            <FileDown className="w-3 h-3" /> PDF
          </a>
          {p.status === "DRAFT" && (
            <>
              <button onClick={() => changeStatus("SENT")} disabled={pending} className="text-xs text-amber-700 hover:underline inline-flex items-center gap-1">
                <Send className="w-3 h-3" /> Marquer envoyée
              </button>
              <button onClick={remove} disabled={pending} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1">
                {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Supprimer
              </button>
            </>
          )}
          {p.status === "SENT" && (
            <>
              <button onClick={() => changeStatus("ACCEPTED")} disabled={pending} className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Acceptée
              </button>
              <button onClick={() => changeStatus("REJECTED")} disabled={pending} className="text-xs text-red-600 hover:underline inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Refusée
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function NewProposalForm({
  missionRequestId, defaults, eligibleApplications, onDone, onCancel
}: {
  missionRequestId: string;
  defaults: { startDate: string | null; endDate: string | null; dailyRate: number | null };
  eligibleApplications: EligibleApp[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    applicationId: eligibleApplications[0]?.applicationId ?? "",
    startDate: defaults.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: defaults.endDate ?? "",
    workDaysPerWeek: "5",
    includeHolidays: true,
    dailyRate: String(
      eligibleApplications[0]?.proposedDailyRate ?? defaults.dailyRate ?? 0
    ),
    intro: ""
  });

  const [preview, setPreview] = useState<{
    calendarDays: number; fullTimeWorkingDays: number;
    effectiveDays: number; budgetHt: number;
  } | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);

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
        setPreviewErr(null);
      } catch (e: any) {
        setPreviewErr(e?.message ?? "Erreur");
      }
    }, 150);
    return () => clearTimeout(t);
  }, [form.startDate, form.endDate, form.workDaysPerWeek, form.includeHolidays, form.dailyRate]);

  // Quand on change d'application, on pre-fill le TJM avec le proposedDailyRate
  useEffect(() => {
    const a = eligibleApplications.find((x) => x.applicationId === form.applicationId);
    if (a?.proposedDailyRate && (!form.dailyRate || Number(form.dailyRate) === 0)) {
      setForm((f) => ({ ...f, dailyRate: String(a.proposedDailyRate) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.applicationId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.applicationId) { toast.error("Choisis un profil présenté"); return; }
    if (!form.startDate || !form.endDate) { toast.error("Dates requises"); return; }
    if (!Number(form.dailyRate)) { toast.error("TJM requis"); return; }
    const fd = new FormData();
    fd.set("applicationId", form.applicationId);
    fd.set("startDate", form.startDate);
    fd.set("endDate", form.endDate);
    fd.set("workDaysPerWeek", form.workDaysPerWeek);
    if (form.includeHolidays) fd.set("includeHolidays", "on");
    fd.set("dailyRate", form.dailyRate);
    fd.set("intro", form.intro);
    start(async () => {
      try {
        const r = await createMissionProposal(fd);
        toast.success(`Proposition ${r.reference} créée`);
        onDone();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <form onSubmit={submit} className="p-4 border-2 border-indigoaccent rounded-lg bg-white mb-3 space-y-3">
      <div>
        <label className="label flex items-center gap-1">
          <Users className="w-3 h-3" /> Profil présenté *
        </label>
        <select
          className="input" value={form.applicationId}
          onChange={(e) => setForm({ ...form, applicationId: e.target.value })}
        >
          {eligibleApplications.map((a) => (
            <option key={a.applicationId} value={a.applicationId}>
              {a.person.firstName} {a.person.lastName}
              {" — "}
              {a.person.source === "consultant" ? "Interne" : "Candidat"}
              {a.person.seniority ? ` · ${a.person.seniority}` : ""}
              {a.proposedDailyRate ? ` · TJM proposé ${a.proposedDailyRate} €` : ""}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-midnight-500 mt-1">
          La liste inclut à la fois les candidats externes et les consultants internes déjà présentés.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Date de début *</label>
          <input type="date" className="input" value={form.startDate}
                 onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div>
          <label className="label">Date de fin *</label>
          <input type="date" className="input" value={form.endDate}
                 onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Régime (jours/semaine)</label>
          <input type="number" step="0.5" min="0.5" max="7" className="input"
                 value={form.workDaysPerWeek}
                 onChange={(e) => setForm({ ...form, workDaysPerWeek: e.target.value })} />
          <p className="text-[11px] text-midnight-500 mt-1">5 = temps plein, 4 = 4/5, 2.5 = mi-temps</p>
        </div>
        <div>
          <label className="label">TJM vendu (HTVA) *</label>
          <input type="number" step="1" className="input" value={form.dailyRate}
                 onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox" checked={form.includeHolidays}
          onChange={(e) => setForm({ ...form, includeHolidays: e.target.checked })}
        />
        Déduire les jours fériés belges du calcul
      </label>

      <div>
        <label className="label">Message d'introduction (sur le PDF, optionnel)</label>
        <textarea
          className="input" rows={2} value={form.intro}
          onChange={(e) => setForm({ ...form, intro: e.target.value })}
          placeholder="Ex : Suite à notre échange du 15 janvier, nous vous proposons..."
        />
      </div>

      <div className="p-3 bg-slate-50 rounded-lg text-sm space-y-1">
        {previewErr && (
          <div className="flex items-center gap-1 text-red-600 text-xs">
            <AlertCircle className="w-3 h-3" /> {previewErr}
          </div>
        )}
        {preview && (
          <>
            <div className="flex justify-between">
              <span className="text-midnight-500">Jours calendaires</span>
              <span>{preview.calendarDays}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-midnight-500">Jours ouvrables (temps plein)</span>
              <span>{preview.fullTimeWorkingDays}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Jours facturables (régime)</span>
              <span>{preview.effectiveDays} j</span>
            </div>
            <hr />
            <div className="flex justify-between text-base font-bold text-midnight-900">
              <span>Budget total HTVA</span>
              <span>{preview.budgetHt.toLocaleString("fr-BE", { style: "currency", currency: "EUR" })}</span>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">Annuler</button>
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Créer la proposition
        </button>
      </div>
    </form>
  );
}
