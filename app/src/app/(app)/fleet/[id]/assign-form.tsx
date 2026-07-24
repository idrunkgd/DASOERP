"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, UserMinus } from "lucide-react";
import { assignVehicle, unassignVehicle } from "@/server/actions/fleet";

export function AssignForm({
  vehicleId, users
}: {
  vehicleId: string;
  users: { id: string; firstName: string; lastName: string }[];
}) {
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    fd.set("vehicleId", vehicleId);
    start(async () => {
      try {
        await assignVehicle(fd);
        toast.success("Véhicule attribué");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <form action={submit} className="space-y-2 text-sm">
      <div>
        <label className="label">Utilisateur</label>
        <select name="userId" required className="input">
          <option value="">— Choisir —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Depuis le *</label>
          <input name="startDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
        </div>
        <div>
          <label className="label">Km au départ</label>
          <input name="startKm" type="number" min="0" placeholder="0" className="input" />
        </div>
      </div>
      <button disabled={pending} className="btn-primary btn-sm w-full">
        <UserPlus className="w-3.5 h-3.5" /> Attribuer
      </button>
    </form>
  );
}

export function UnassignButton({ vehicleId }: { vehicleId: string }) {
  const [pending, start] = useTransition();
  const [showKm, setShowKm] = useState(false);
  const [endKm, setEndKm] = useState<string>("");

  function submit() {
    start(async () => {
      try {
        await unassignVehicle(vehicleId, undefined, endKm ? Number(endKm) : undefined);
        toast.success("Attribution clôturée");
        setShowKm(false);
        setEndKm("");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!showKm) {
    return (
      <button type="button" onClick={() => setShowKm(true)} className="btn-ghost btn-sm text-red-600">
        <UserMinus className="w-3.5 h-3.5" /> Clôturer l'attribution
      </button>
    );
  }
  return (
    <div className="space-y-2 text-xs">
      <input
        type="number" min="0"
        value={endKm}
        onChange={(e) => setEndKm(e.target.value)}
        placeholder="Km au retour"
        className="input text-sm"
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => setShowKm(false)} className="btn-ghost btn-sm flex-1">Annuler</button>
        <button type="button" onClick={submit} disabled={pending} className="btn-primary btn-sm flex-1">Clôturer</button>
      </div>
    </div>
  );
}
