"use client";
/**
 * Bloc "Congés" sur la page /me (onglet RH).
 *
 * Affiche :
 *   - le solde annuel (quota, pris, en attente, restant)
 *   - un formulaire de nouvelle demande
 *   - la liste des dernières demandes avec leur statut
 *
 * Si le consultant a une mission active, la case "demandé chez le client
 * et accordé" s'active pour matérialiser l'accord côté planning mission.
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Loader2, Plane, Send, Check, X, Trash2, Ban, AlertCircle
} from "lucide-react";
import {
  createLeaveRequest,
  submitLeaveRequest,
  cancelLeaveRequest,
  deleteLeaveRequest,
  suggestBusinessDays
} from "@/server/actions/leave-requests";

type ExistingLeave = {
  id: string;
  startDate: string;    // ISO
  endDate: string;      // ISO
  days: number;
  type: string;
  reason: string | null;
  status: string;
  missionRef: string | null;
  clientApproved: boolean;
  rejectionReason: string | null;
};

type ActiveMission = { id: string; label: string };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: "Brouillon",  cls: "bg-midnight-100 text-midnight-700" },
  SUBMITTED: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  APPROVED:  { label: "Approuvé",   cls: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "Refusé",     cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Annulé",     cls: "bg-midnight-100 text-midnight-500" }
};

const TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Congé payé", RTT: "RTT", UNPAID: "Sans solde",
  SPECIAL: "Spécial", OTHER: "Autre"
};

export function LeaveRequestBlock({
  balance,
  existing,
  activeMissions
}: {
  balance: {
    year: number; entitled: number; approved: number;
    pending: number; remaining: number; remainingIfAllApproved: number;
  };
  existing: ExistingLeave[];
  activeMissions: ActiveMission[];
}) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    startDate: today,
    endDate: today,
    days: "1",
    type: "ANNUAL",
    reason: "",
    missionId: activeMissions[0]?.id ?? "",
    clientApproved: false,
    clientApprovalNotes: ""
  });

  async function recalcDays(newStart: string, newEnd: string) {
    const n = await suggestBusinessDays(newStart, newEnd);
    setForm((f) => ({ ...f, days: String(n) }));
  }

  function submit(fd: FormData) {
    // days est le champ hidden serialisé
    fd.set("days", form.days);
    fd.set("clientApproved", form.clientApproved ? "true" : "false");
    start(async () => {
      try {
        const res = await createLeaveRequest(fd);
        toast.success("Demande créée (brouillon). Soumettez-la pour approbation.");
        setShowForm(false);
        setForm({
          startDate: today, endDate: today, days: "1", type: "ANNUAL",
          reason: "", missionId: activeMissions[0]?.id ?? "",
          clientApproved: false, clientApprovalNotes: ""
        });
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function submitDraft(id: string) {
    start(async () => {
      try {
        await submitLeaveRequest(id);
        toast.success("Demande soumise pour approbation");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function cancel(id: string) {
    if (!confirm("Annuler cette demande ?")) return;
    start(async () => {
      try {
        await cancelLeaveRequest(id);
        toast.success("Annulée");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  function remove(id: string) {
    if (!confirm("Supprimer cette demande définitivement ?")) return;
    start(async () => {
      try {
        await deleteLeaveRequest(id);
        toast.success("Supprimée");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  const hasActiveMission = activeMissions.length > 0;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-1.5">
            <Plane className="w-4 h-4 text-midnight-500" /> Mes congés
          </h3>
          <p className="text-xs text-midnight-500">
            Solde annuel {balance.year} · demande soumise à approbation manager
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary text-sm"
          >
            + Nouvelle demande
          </button>
        )}
      </div>

      {/* Solde */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <BalanceCard label="Quota" value={balance.entitled} sub="jours/an" />
        <BalanceCard label="Pris"  value={balance.approved} sub="approuvés" tone="neutral" />
        <BalanceCard label="En attente" value={balance.pending} sub="soumis" tone={balance.pending > 0 ? "warn" : "neutral"} />
        <BalanceCard
          label="Solde"
          value={balance.remaining}
          sub={balance.pending > 0 ? `${balance.remainingIfAllApproved} si tout approuvé` : "restants"}
          tone={balance.remaining > 5 ? "good" : balance.remaining >= 0 ? "warn" : "bad"}
        />
      </div>

      {/* Form nouvelle demande */}
      {showForm && (
        <form action={submit} className="space-y-3 mb-4 bg-midnight-50/50 p-3 rounded border border-midnight-200">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Début</label>
              <input
                name="startDate" type="date" required
                value={form.startDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, startDate: v }));
                  recalcDays(v, form.endDate);
                }}
                className="input"
              />
            </div>
            <div>
              <label className="label">Fin</label>
              <input
                name="endDate" type="date" required
                value={form.endDate}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, endDate: v }));
                  recalcDays(form.startDate, v);
                }}
                className="input"
              />
            </div>
            <div>
              <label className="label">Jours ouvrés</label>
              <input
                type="number" step="0.5" min="0.5" max="365" required
                value={form.days}
                onChange={(e) => setForm({ ...form, days: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select
                name="type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="input"
              >
                <option value="ANNUAL">Congé payé</option>
                <option value="RTT">RTT</option>
                <option value="UNPAID">Sans solde</option>
                <option value="SPECIAL">Spécial (mariage, décès…)</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div>
              <label className="label">Raison (optionnel)</label>
              <input
                name="reason" type="text" maxLength={200}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="input"
                placeholder="Vacances, événement familial…"
              />
            </div>
          </div>

          {/* Consultant en mission : rattachement + accord client */}
          {hasActiveMission && (
            <div className="border border-indigoaccent/30 bg-indigoaccent/5 rounded p-3 space-y-2">
              <div>
                <label className="label">Mission concernée</label>
                <select
                  name="missionId"
                  value={form.missionId}
                  onChange={(e) => setForm({ ...form, missionId: e.target.value })}
                  className="input"
                >
                  <option value="">— Aucune / interne —</option>
                  {activeMissions.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-start gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={form.clientApproved}
                  onChange={(e) => setForm({ ...form, clientApproved: e.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Demandé chez le client et accordé</span>
                  <span className="block text-[11px] text-midnight-500">
                    Coche si tu as déjà validé les dates côté planning du chef de projet client.
                  </span>
                </span>
              </label>
              {form.clientApproved && (
                <div>
                  <label className="label">Note d'accord client (optionnel)</label>
                  <input
                    name="clientApprovalNotes" type="text" maxLength={500}
                    value={form.clientApprovalNotes}
                    onChange={(e) => setForm({ ...form, clientApprovalNotes: e.target.value })}
                    className="input text-sm"
                    placeholder="ex: Validé par Marc lors du daily du 12/06"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Notes internes (optionnel)</label>
            <textarea
              name="notes" maxLength={1000} rows={2}
              className="input"
              placeholder="Informations complémentaires pour le manager…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary text-sm"
              disabled={pending}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary text-sm" disabled={pending}>
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer (brouillon)"}
            </button>
          </div>
        </form>
      )}

      {/* Historique */}
      {existing.length === 0 ? (
        <p className="text-xs text-midnight-400 text-center py-3">
          Aucune demande de congé pour l'instant.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {existing.map((l) => {
            const st = STATUS_LABELS[l.status] ?? { label: l.status, cls: "bg-midnight-100" };
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 text-sm px-2 py-1.5 border border-midnight-200 rounded"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">
                      {new Date(l.startDate).toLocaleDateString("fr-BE")}
                      {" → "}
                      {new Date(l.endDate).toLocaleDateString("fr-BE")}
                    </span>
                    <span className="text-[10px] bg-midnight-100 text-midnight-700 rounded px-1.5 py-0.5">
                      {TYPE_LABELS[l.type] ?? l.type}
                    </span>
                    <span className="text-[11px] font-medium tabular-nums text-midnight-700">
                      {l.days}j
                    </span>
                  </div>
                  {(l.reason || l.missionRef) && (
                    <div className="text-[10px] text-midnight-500 truncate mt-0.5">
                      {l.reason && <>{l.reason}</>}
                      {l.reason && l.missionRef && " · "}
                      {l.missionRef && <>Mission {l.missionRef}</>}
                      {l.clientApproved && (
                        <span className="ml-1 text-emerald-700">✓ client OK</span>
                      )}
                    </div>
                  )}
                  {l.rejectionReason && (
                    <div className="text-[10px] text-red-600 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {l.rejectionReason}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] rounded px-1.5 py-0.5 shrink-0 ${st.cls}`}>
                  {st.label}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  {l.status === "DRAFT" && (
                    <button
                      onClick={() => submitDraft(l.id)}
                      className="text-amber-700 hover:bg-amber-50 rounded p-1"
                      title="Soumettre"
                      disabled={pending}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {l.status === "SUBMITTED" && (
                    <button
                      onClick={() => cancel(l.id)}
                      className="text-midnight-500 hover:bg-midnight-100 rounded p-1"
                      title="Annuler la demande"
                      disabled={pending}
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(l.status === "DRAFT" || l.status === "REJECTED" || l.status === "CANCELLED") && (
                    <button
                      onClick={() => remove(l.id)}
                      className="text-midnight-400 hover:text-red-600 rounded p-1"
                      title="Supprimer"
                      disabled={pending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function BalanceCard({
  label, value, sub, tone = "info"
}: {
  label: string; value: number; sub?: string;
  tone?: "info" | "good" | "warn" | "bad" | "neutral";
}) {
  const color =
    tone === "good"    ? "text-emerald-700" :
    tone === "warn"    ? "text-amber-700"   :
    tone === "bad"     ? "text-red-700"     :
    tone === "neutral" ? "text-midnight-800" :
                         "text-indigoaccent";
  return (
    <div className="border border-midnight-200 rounded px-2 py-1.5">
      <div className="text-[10px] text-midnight-500">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-midnight-400 -mt-0.5">{sub}</div>}
    </div>
  );
}
