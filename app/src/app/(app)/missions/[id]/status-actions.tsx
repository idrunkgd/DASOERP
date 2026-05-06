"use client";
import { useTransition } from "react";
import { setMissionExecStatus, deleteMissionExec } from "@/server/actions/mission-execs";
import { toast } from "sonner";

const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  PLANNED:   [{ value: "ACTIVE", label: "Démarrer" }, { value: "CANCELLED", label: "Annuler" }],
  ACTIVE:    [{ value: "EXTENDED", label: "Prolonger" }, { value: "ON_HOLD", label: "Mettre en pause" }, { value: "COMPLETED", label: "Terminer" }, { value: "CANCELLED", label: "Annuler" }],
  EXTENDED:  [{ value: "COMPLETED", label: "Terminer" }, { value: "CANCELLED", label: "Annuler" }],
  ON_HOLD:   [{ value: "ACTIVE", label: "Reprendre" }, { value: "CANCELLED", label: "Annuler" }],
  COMPLETED: [],
  CANCELLED: []
};

export function MissionExecStatusActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const opts = TRANSITIONS[status] ?? [];
  return (
    <div className="flex items-center gap-2">
      {opts.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value; if (!v) return;
            if (!window.confirm(`Changer le statut vers "${v}" ?`)) { e.target.value = ""; return; }
            start(async () => { try { await setMissionExecStatus(id, v as any); toast.success("Statut mis à jour"); } catch (err: any) { toast.error(err.message); } });
            e.target.value = "";
          }}
          className="input h-9 text-sm w-[200px]"
        >
          <option value="">Changer de statut...</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {(status === "COMPLETED" || status === "CANCELLED") && (
        <button
          onClick={() => { if (window.confirm("Supprimer définitivement cette mission ?")) start(async () => { try { await deleteMissionExec(id); } catch (e: any) { toast.error(e.message); } }); }}
          className="btn-danger btn-sm"
        >Supprimer</button>
      )}
    </div>
  );
}
