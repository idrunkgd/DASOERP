"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, X, Pencil, Trash2 } from "lucide-react";
import { upsertFleetBadge, deleteFleetBadge } from "@/server/actions/fleet-badges";

type UserOption = { id: string; firstName: string; lastName: string };
type VehicleOption = { id: string; plate: string; brand: string; model: string };
type Badge = {
  id: string; type: string; label: string; identifier: string | null;
  provider: string | null; monthlyFee: any;
  assignedUserId: string | null; assignedVehicleId: string | null;
  startDate: Date | null; endDate: Date | null;
  notes: string | null; active: boolean;
};

const TYPES = [
  { value: "ACCESS_BADGE",  label: "Badge d'accès" },
  { value: "RECHARGE_CARD", label: "Carte de recharge" },
  { value: "TOLL_TAG",      label: "Télépéage" },
  { value: "FUEL_CARD",     label: "Carte carburant" },
  { value: "PARKING_CARD",  label: "Parking" },
  { value: "OTHER",         label: "Autre" }
];

export function BadgeFormButton({ users, vehicles, existing }: { users: UserOption[]; vehicles: VehicleOption[]; existing?: Badge }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-primary text-sm inline-flex items-center gap-1" onClick={() => setOpen(true)}>
        {existing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {existing ? "Modifier" : "Nouveau"}
      </button>
      {open && <BadgeModal users={users} vehicles={vehicles} existing={existing} onClose={() => setOpen(false)} />}
    </>
  );
}

function BadgeModal({ users, vehicles, existing, onClose }: {
  users: UserOption[]; vehicles: VehicleOption[]; existing?: Badge; onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-bold">{existing ? "Modifier badge/carte" : "Nouveau badge/carte"}</h3>
          <button onClick={onClose} className="text-midnight-400 hover:text-midnight-900"><X className="w-4 h-4" /></button>
        </div>
        <form
          action={(fd) => start(async () => {
            try {
              await upsertFleetBadge(fd);
              toast.success(existing ? "Badge mis à jour" : "Badge créé");
              onClose();
            } catch (err: any) { toast.error(err?.message || "Erreur"); }
          })}
          className="p-5 space-y-4"
        >
          {existing && <input type="hidden" name="id" value={existing.id} />}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" defaultValue={existing?.type ?? "ACCESS_BADGE"} className="input" required>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Libellé</label>
              <input name="label" defaultValue={existing?.label ?? ""} required maxLength={200} className="input" placeholder="Ex : Chargemap Pro, Badge UCB…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Identifiant</label>
              <input name="identifier" defaultValue={existing?.identifier ?? ""} maxLength={120} className="input" placeholder="Numéro badge/carte" />
            </div>
            <div>
              <label className="label">Fournisseur</label>
              <input name="provider" defaultValue={existing?.provider ?? ""} maxLength={120} className="input" placeholder="Chargemap, Total, Sanef…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Abonnement mensuel (€)</label>
              <input name="monthlyFee" type="number" step="0.01" min="0" defaultValue={existing?.monthlyFee ? Number(existing.monthlyFee) : ""} className="input" placeholder="0.00" />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="active" defaultChecked={existing?.active ?? true} className="w-4 h-4" />
                <span className="text-midnight-700 font-medium">Actif</span>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="label">Attribution</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Consultant</label>
                <select name="assignedUserId" defaultValue={existing?.assignedUserId ?? ""} className="input">
                  <option value="">— Stock / non attribué —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Véhicule</label>
                <select name="assignedVehicleId" defaultValue={existing?.assignedVehicleId ?? ""} className="input">
                  <option value="">— Aucun véhicule associé —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Début</label>
              <input name="startDate" type="date" defaultValue={iso(existing?.startDate)} className="input" />
            </div>
            <div>
              <label className="label">Fin</label>
              <input name="endDate" type="date" defaultValue={iso(existing?.endDate)} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea name="notes" defaultValue={existing?.notes ?? ""} maxLength={1000} rows={2} className="input" placeholder="Notes internes (PIN, contact fournisseur, remarques…)" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-ghost text-sm">Annuler</button>
            <button type="submit" disabled={pending} className="btn-primary text-sm">
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              {existing ? "Sauvegarder" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RowActions({ badge, users, vehicles }: { badge: Badge; users: UserOption[]; vehicles: VehicleOption[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-end gap-1">
      <BadgeFormButton users={users} vehicles={vehicles} existing={badge} />
      <button
        title="Supprimer"
        className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
        onClick={() => {
          if (!confirm(`Supprimer le badge "${badge.label}" ?`)) return;
          start(async () => {
            try { await deleteFleetBadge(badge.id); toast.success("Supprimé"); }
            catch (err: any) { toast.error(err?.message || "Erreur"); }
          });
        }}
        disabled={pending}
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
