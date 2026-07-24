"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Save, Trash2 } from "lucide-react";
import { upsertLeasingContract, deleteLeasingContract } from "@/server/actions/fleet";

type Initial = {
  lessor: string;
  contractRef: string | null;
  startDate: string;
  endDate: string;
  monthlyAmount: number;
  kmIncludedYear: number | null;
  cashflowCategory: string | null;
  notes: string | null;
} | null;

export function ContractForm({ vehicleId, initial }: { vehicleId: string; initial: Initial }) {
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    fd.set("vehicleId", vehicleId);
    start(async () => {
      try {
        await upsertLeasingContract(fd);
        toast.success("Contrat sauvegardé · ligne cashflow synchronisée");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function del() {
    if (!confirm("Supprimer le contrat leasing ? La ligne cashflow associée sera retirée.")) return;
    start(async () => {
      try {
        await deleteLeasingContract(vehicleId);
        toast.success("Contrat supprimé");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Bailleur *</label>
          <input name="lessor" required defaultValue={initial?.lessor ?? ""} className="input" placeholder="ALD, Arval, Athlon…" />
        </div>
        <div>
          <label className="label">Référence contrat</label>
          <input name="contractRef" defaultValue={initial?.contractRef ?? ""} className="input" placeholder="Optionnel" />
        </div>
        <div>
          <label className="label">Du *</label>
          <input name="startDate" type="date" required defaultValue={initial?.startDate ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Au *</label>
          <input name="endDate" type="date" required defaultValue={initial?.endDate ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Mensualité TVAC (€) *</label>
          <input name="monthlyAmount" type="number" step="0.01" min="0" required
            defaultValue={initial?.monthlyAmount ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Forfait km / an</label>
          <input name="kmIncludedYear" type="number" min="0"
            defaultValue={initial?.kmIncludedYear ?? ""} className="input" placeholder="25000" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Catégorie cashflow</label>
          <input name="cashflowCategory" type="text"
            defaultValue={initial?.cashflowCategory ?? ""}
            className="input" placeholder='Ex: "voiture" (laissé vide → "Leasing véhicules")' />
          <p className="text-[10px] text-midnight-500 mt-1">
            Nom exact de la catégorie sous laquelle la ligne apparaîtra dans le cashflow.
          </p>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea name="notes" rows={2} defaultValue={initial?.notes ?? ""} className="input" />
      </div>
      <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-800">
        💡 Sauvegarder = créer/mettre à jour une ligne récurrente "Leasing véhicules" dans le cashflow entre ces 2 dates.
      </div>
      <div className="flex justify-end gap-2">
        {initial && (
          <button type="button" onClick={del} disabled={pending} className="btn-ghost text-danger">
            <Trash2 className="w-4 h-4" /> Supprimer le contrat
          </button>
        )}
        <button disabled={pending} className="btn-primary">
          <Save className="w-4 h-4" /> {initial ? "Mettre à jour" : "Créer le contrat"}
        </button>
      </div>
    </form>
  );
}
