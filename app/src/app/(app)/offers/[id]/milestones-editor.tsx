"use client";
import { useTransition, useState, useEffect } from "react";
import { addMilestone, deleteMilestone, setMilestoneStatus } from "@/server/actions/offers";
import { validateMilestonesTotal } from "@/lib/calc";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

type M = {
  id: string; label: string; amount: string | number; percentage: string | number | null;
  expectedAt: Date | string | null; trigger: string | null; status: string;
};

const STATUSES = [
  { value: "PLANNED", label: "Prévue" },
  { value: "READY", label: "Prête" },
  { value: "INVOICED", label: "Facturée" },
  { value: "TRANSMITTED", label: "Transmise Peppol" },
  { value: "PAID", label: "Payée" },
  { value: "CANCELLED", label: "Annulée" }
];

export function MilestonesEditor({ offerId, milestones, totalSell, readOnly = false }: { offerId: string; milestones: M[]; totalSell: number; readOnly?: boolean }) {
  const [pending, start] = useTransition();
  const [pctInput, setPctInput] = useState("");
  const [amountInput, setAmountInput] = useState("");

  // Si l'utilisateur tape un %, on calcule l'amount auto, et inversement.
  useEffect(() => {
    if (pctInput === "") return;
    const p = Number(pctInput);
    if (Number.isFinite(p) && totalSell > 0) {
      setAmountInput((Math.round(totalSell * p / 100 * 100) / 100).toFixed(2));
    }
  }, [pctInput, totalSell]);

  const validation = validateMilestonesTotal(
    milestones.filter(m => m.status !== "CANCELLED").map(m => Number(m.amount)),
    totalSell
  );

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Tranches de facturation</h2>
        {totalSell > 0 && (
          <ValidationBadge ok={validation.ok} sum={validation.sum} pct={validation.pct} delta={validation.delta} totalSell={totalSell} />
        )}
      </div>
      {milestones.length === 0 ? (
        <p className="text-sm text-midnight-500 mb-3">Aucune tranche définie.</p>
      ) : (
        <table className="table-base mb-4">
          <thead><tr>
            <th>Libellé</th>
            <th className="text-right">Montant HT</th><th className="text-right">%</th>
            <th>Date prévue</th><th>Déclencheur</th><th>Statut</th><th></th>
          </tr></thead>
          <tbody>
            {milestones.map(m => {
              const pct = totalSell > 0 ? (Number(m.amount) / totalSell) * 100 : 0;
              return (
                <tr key={m.id}>
                  <td className="font-medium">{m.label}</td>
                  <td className="text-right tabular-nums">{formatCurrency(m.amount)}</td>
                  <td className="text-right tabular-nums">{pct.toFixed(1)}%</td>
                  <td>{m.expectedAt ? formatDate(m.expectedAt) : "—"}</td>
                  <td className="text-midnight-700 text-xs">{m.trigger ?? "—"}</td>
                  <td>
                    <select
                      defaultValue={m.status}
                      onChange={(e) => start(async () => {
                        try { await setMilestoneStatus(m.id, e.target.value as any); toast.success("Statut mis à jour"); }
                        catch (err: any) { toast.error(err.message); }
                      })}
                      className="input h-7 text-xs py-0"
                    >
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="text-right">
                    {!readOnly && (
                      <button
                        onClick={() => { if (window.confirm("Supprimer cette tranche ?")) start(async () => { await deleteMilestone(m.id, offerId); }); }}
                        className="text-danger hover:text-red-700"
                      ><Trash2 className="w-4 h-4" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {!readOnly && (
      <form
        action={(fd) => start(async () => {
          try {
            await addMilestone(offerId, fd);
            (document.getElementById(`new-ms-${offerId}`) as HTMLFormElement)?.reset();
            setPctInput(""); setAmountInput("");
            toast.success("Tranche ajoutée");
          } catch (e: any) { toast.error(e.message); }
        })}
        id={`new-ms-${offerId}`}
        className="grid grid-cols-12 gap-2 items-end border-t border-border pt-3"
      >
        <input name="label" placeholder="Ex: Acompte 30%" required className="input col-span-3" />
        <input
          name="percentage" type="number" step="0.5" min="0" max="100"
          value={pctInput} onChange={(e) => setPctInput(e.target.value)}
          placeholder="%" className="input col-span-1"
        />
        <input
          name="amount" type="number" step="0.01" required
          value={amountInput} onChange={(e) => { setAmountInput(e.target.value); setPctInput(""); }}
          placeholder="Montant HT" className="input col-span-2"
        />
        <input name="expectedAt" type="date" className="input col-span-2" />
        <input name="trigger" placeholder="Déclencheur" className="input col-span-3" />
        <button disabled={pending} className="btn-primary col-span-1"><Plus className="w-4 h-4" /></button>
      </form>
      )}
      {!readOnly && totalSell <= 0 && (
        <p className="text-xs text-midnight-500 mt-2">Astuce : ajoutez d'abord des lignes pour avoir un total HT, puis les % calculent automatiquement les montants.</p>
      )}
    </section>
  );
}

function ValidationBadge({ ok, sum, pct, delta, totalSell }: { ok: boolean; sum: number; pct: number; delta: number; totalSell: number }) {
  return ok ? (
    <span className="badge-success flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Tranches = 100% ({formatCurrency(sum)})</span>
  ) : (
    <span className="badge-warning flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      {pct.toFixed(1)}% — {delta < 0 ? `manque ${formatCurrency(-delta)}` : `excès ${formatCurrency(delta)}`} (cible {formatCurrency(totalSell)})
    </span>
  );
}
