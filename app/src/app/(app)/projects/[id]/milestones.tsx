"use client";
import { useTransition } from "react";
import {
  addMilestoneToProject,
  deleteMilestoneFromProject,
  updateMilestoneDate
} from "@/server/actions/project-milestones";
import { setMilestoneStatus } from "@/server/actions/offers";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

type M = {
  id: string; label: string; amount: string | number; percentage: string | number | null;
  expectedAt: Date | string | null; trigger: string | null; status: string;
};

const STATUSES = [
  { value: "PLANNED", label: "Prévue" },
  { value: "READY", label: "Prête" },
  { value: "TRANSMITTED", label: "Transmise Peppol" },
  { value: "PAID", label: "Payée" },
  { value: "CANCELLED", label: "Annulée" }
];

export function ProjectMilestones({ projectId, milestones }: { projectId: string; milestones: M[] }) {
  const [pending, start] = useTransition();
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Tranches de facturation</h2>
      {milestones.length === 0 ? (
        <p className="text-sm text-midnight-500 mb-3">Aucune tranche pour ce projet.</p>
      ) : (
        <>
          <p className="text-[11px] text-midnight-500 mb-2">
            La date est celle de l'encaissement attendu sur le compte bancaire.
            Modifie-la quand la facturation est confirmée ou décalée — le
            cashflow se met à jour automatiquement.
          </p>
          <table className="table-base mb-4">
            <thead><tr><th>Libellé</th><th className="text-right">Montant</th><th>Date encaissement</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {milestones.map(m => {
                const expectedISO = m.expectedAt
                  ? (typeof m.expectedAt === "string"
                      ? m.expectedAt.slice(0, 10)
                      : new Date(m.expectedAt).toISOString().slice(0, 10))
                  : "";
                return (
                  <tr key={m.id}>
                    <td className="font-medium">{m.label}</td>
                    <td className="text-right tabular-nums">{formatCurrency(m.amount)}</td>
                    <td>
                      <input
                        type="date"
                        defaultValue={expectedISO}
                        onChange={(e) =>
                          start(async () => {
                            try {
                              await updateMilestoneDate(m.id, e.target.value || null);
                              toast.success("Date mise à jour");
                            } catch (err: any) {
                              toast.error(err.message);
                            }
                          })
                        }
                        className="input h-7 text-xs py-0 w-36"
                      />
                    </td>
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
                      <button
                        onClick={() => { if (window.confirm("Supprimer cette tranche ?")) start(async () => { await deleteMilestoneFromProject(m.id, projectId); }); }}
                        className="text-danger hover:text-red-700"
                      ><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
      <form
        action={(fd) => start(async () => {
          try { await addMilestoneToProject(projectId, fd); (document.getElementById(`new-pms-${projectId}`) as HTMLFormElement)?.reset(); toast.success("Tranche ajoutée"); }
          catch (e: any) { toast.error(e.message); }
        })}
        id={`new-pms-${projectId}`}
        className="grid grid-cols-12 gap-2 items-end border-t border-border pt-3"
      >
        <input name="label" placeholder="Ex: Livraison phase 1" required className="input col-span-4" />
        <input name="amount" type="number" step="0.01" placeholder="Montant HT" required className="input col-span-2" />
        <input name="expectedAt" type="date" className="input col-span-2" />
        <input name="trigger" placeholder="Déclencheur" className="input col-span-3" />
        <button disabled={pending} className="btn-primary col-span-1"><Plus className="w-4 h-4" /></button>
      </form>
    </section>
  );
}
