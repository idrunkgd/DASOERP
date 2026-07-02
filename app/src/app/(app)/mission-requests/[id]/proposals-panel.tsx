"use client";
/**
 * Panneau « Propositions consultants » sur la fiche MissionRequest.
 *
 * - Liste des propositions existantes avec statut, budget calculé, TJM.
 * - Bouton « + Proposer un consultant » qui ouvre un formulaire modal
 *   avec preview live des jours ouvrés et du budget (recalcul serveur
 *   à chaque changement, pour fiabilité vis-à-vis des fériés belges).
 * - Actions par proposition : PDF, changer statut, supprimer si DRAFT.
 */
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus, FileDown, Send, Check, X, Trash2, Loader2, User as UserIcon,
  CheckCircle2, AlertCircle
} from "lucide-react";
import {
  createMissionProposal,
  deleteMissionProposal,
  setMissionProposalStatus,
  previewProposalTotals
} from "@/server/actions/mission-proposals";

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  seniority: string | null;
  photoUrl: string | null;
  dailyCost: number | null;
  minDailyRate: number | null;
};

type Proposal = {
  id: string;
  reference: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "CANCELLED";
  candidate: { id: string; firstName: string; lastName: string; photoUrl: string | null; seniority: string | null };
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
  missionRequestId, defaults, candidates, proposals
}: {
  missionRequestId: string;
  defaults: { startDate: string | null; endDate: string | null; dailyRate: number | null };
  candidates: Candidate[];
  proposals: Proposal[];
}) {
  const [creating, setCreating] = useState(false);

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Propositions consultants ({proposals.length})</h2>
        {!creating && (
          <button onClick={() => setCreating(true)} className="btn-primary btn-sm">
            <Plus className="w-3 h-3" /> Proposer un consultant
          </button>
        )}
      </div>

      {creating && (
        <NewProposalForm
          missionRequestId={missionRequestId}
          defaults={defaults}
          candidates={candidates}
          onDone={() => setCreating(false)}
          onCancel={() => setCreating(false)}
        />
      )}

      {proposals.length === 0 && !creating && (
        <p className="text-sm text-midnight-500">
          Aucune proposition. Utilise « Proposer un consultant » pour générer
          une offre par consultant (dates, régime, TJM, budget calculé
          automatiquement sur jours ouvrés belges).
        </p>
      )}

      {proposals.length > 0 && (
        <ul className="space-y-2 mt-2">
          {proposals.map((p) => (
            <ProposalRow key={p.id} p={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProposalRow({ p }: { p: Proposal }) {
  const [pending, start] = useTransition();
  const st = STATUS_META[p.status];

  function changeStatus(next: Proposal["status"]) {
    if (next === "REJECTED") {
      const reason = prompt("Raison du refus (optionnel)") ?? undefined;
      start(async () => {
        try { await setMissionProposalStatus(p.id, "REJECTED", reason); toast.success("Marquée refusée"); }
        catch (e: any) { toast.error(e?.message ?? "Erreur"); }
      });
      return;
    }
    start(async () => {
      try { await setMissionProposalStatus(p.id, next); toast.success(`Statut : ${STATUS_META[next].label}`); }
      catch (e: any) { toast.error(e?.message ?? "Erreur"); }
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
        {p.candidate.photoUrl ? (
          <img src={p.candidate.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
            <UserIcon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/candidates/${p.candidate.id}`} className="font-medium hover:underline">
              {p.candidate.firstName} {p.candidate.lastName}
            </Link>
            {p.candidate.seniority && <span className="text-xs text-midnight-500">{p.candidate.seniority}</span>}
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
  missionRequestId, defaults, candidates, onDone, onCancel
}: {
  missionRequestId: string;
  defaults: { startDate: string | null; endDate: string | null; dailyRate: number | null };
  candidates: Candidate[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    candidateId: candidates[0]?.id ?? "",
    startDate: defaults.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: defaults.endDate ?? "",
    workDaysPerWeek: "5",
    includeHolidays: true,
    dailyRate: String(defaults.dailyRate ?? 0),
    intro: ""
  });

  // Preview live du budget calculé (server-side pour fiabilité fériés)
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
          startDate: form.startDate,
          endDate: form.endDate,
          workDaysPerWeek: Number(form.workDaysPerWeek || 5),
          includeHolidays: form.includeHolidays,
          dailyRate: Number(form.dailyRate || 0)
        });
        setPreview(r);
        setPreviewErr(null);
      } catch (e: any) {
        setPreviewErr(e?.message ?? "Erreur de calcul");
      }
    }, 150);
    return () => clearTimeout(t);
  }, [form.startDate, form.endDate, form.workDaysPerWeek, form.includeHolidays, form.dailyRate]);

  // Auto-set daily rate à minDailyRate si le candidat en a un et rien n'est déjà mis
  useEffect(() => {
    const c = candidates.find((x) => x.id === form.candidateId);
    if (c?.minDailyRate && (!form.dailyRate || Number(form.dailyRate) === 0)) {
      setForm((f) => ({ ...f, dailyRate: String(c.minDailyRate) }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.candidateId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.candidateId) { toast.error("Choisis un consultant"); return; }
    if (!form.startDate || !form.endDate) { toast.error("Dates requises"); return; }
    if (!Number(form.dailyRate)) { toast.error("TJM requis"); return; }
    const fd = new FormData();
    fd.set("missionRequestId", missionRequestId);
    fd.set("candidateId", form.candidateId);
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

  const candidate = candidates.find((c) => c.id === form.candidateId);
  const cost = candidate?.dailyCost ?? null;
  const rate = Number(form.dailyRate || 0);
  const marginPct = cost && rate > 0 ? Math.round(((rate - cost) / rate) * 100) : null;

  return (
    <form onSubmit={submit} className="p-4 border-2 border-indigoaccent rounded-lg bg-white mb-3 space-y-3">
      <div>
        <label className="label">Consultant proposé *</label>
        <select
          className="input" value={form.candidateId}
          onChange={(e) => setForm({ ...form, candidateId: e.target.value })}
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
              {c.seniority ? ` — ${c.seniority}` : ""}
              {c.dailyCost ? ` (coût ${c.dailyCost}€/j)` : ""}
            </option>
          ))}
        </select>
        {candidate?.minDailyRate && (
          <p className="text-[11px] text-midnight-500 mt-1">
            TJM minimum souhaité par le candidat : {candidate.minDailyRate} €
          </p>
        )}
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
          {marginPct !== null && (
            <p className={`text-[11px] mt-1 ${marginPct < 15 ? "text-red-600" : marginPct < 30 ? "text-amber-700" : "text-emerald-700"}`}>
              Marge estimée : {marginPct}% ({(rate - (cost ?? 0)).toFixed(0)} €/j)
            </p>
          )}
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

      {/* Preview live des totaux calculés */}
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
