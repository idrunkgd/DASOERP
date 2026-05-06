"use client";
import { useTransition } from "react";
import { setMissionStatus, deleteMission } from "@/server/actions/missions";
import { toast } from "sonner";

const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  NEW:         [{ value: "QUALIFYING", label: "Qualifier" }, { value: "CANCELLED", label: "Annuler" }],
  QUALIFYING:  [{ value: "PRESENTING", label: "Démarrer présentations" }, { value: "LOST", label: "Perdue" }, { value: "CANCELLED", label: "Annuler" }],
  PRESENTING:  [{ value: "CONTRACTED", label: "Marquer contractée" }, { value: "LOST", label: "Perdue" }, { value: "CANCELLED", label: "Annuler" }],
  CONTRACTED:  [],
  LOST:        [{ value: "NEW", label: "Rouvrir" }],
  CANCELLED:   [{ value: "NEW", label: "Rouvrir" }]
};

export function MissionStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const opts = TRANSITIONS[status] ?? [];
  return (
    <div className="flex items-center gap-2">
      {opts.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value; if (!v) return;
            let reason: string | undefined;
            if (v === "LOST") {
              reason = window.prompt("Raison de la perte (optionnel) :") ?? undefined;
            } else if (!window.confirm(`Changer le statut vers "${v}" ?`)) { e.target.value = ""; return; }
            start(async () => { try { await setMissionStatus(id, v as any, reason ?? null); toast.success("Statut mis à jour"); } catch (err: any) { toast.error(err.message); } });
            e.target.value = "";
          }}
          className="input h-9 text-sm w-[230px]"
        >
          <option value="">Changer de statut...</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <button
        onClick={() => { if (window.confirm("Supprimer cette demande ?")) start(async () => { await deleteMission(id); }); }}
        className="btn-danger btn-sm"
      >Supprimer</button>
    </div>
  );
}
