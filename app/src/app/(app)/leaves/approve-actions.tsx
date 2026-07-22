"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X, Trash2 } from "lucide-react";
import { approveLeaveRequest, deleteLeaveRequest } from "@/server/actions/leave-requests";

export function ApproveActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  function run(approve: boolean) {
    const reason = approve ? undefined : prompt("Motif du refus ?");
    if (!approve && reason === null) return;
    start(async () => {
      try {
        await approveLeaveRequest(id, approve, reason ?? undefined);
        toast.success(approve ? "Approuvé" : "Refusé");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => run(true)}
        disabled={pending}
        className="text-emerald-700 hover:bg-emerald-50 rounded p-1"
        title="Approuver"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={() => run(false)}
        disabled={pending}
        className="text-red-700 hover:bg-red-50 rounded p-1"
        title="Refuser"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Bouton corbeille pour supprimer une demande de congé — utilisable même sur
 * une demande APPROVED. Le solde se recalcule automatiquement (le calcul
 * dans lib/leave-balance.ts ne compte que les LeaveRequest existants avec
 * status APPROVED/SUBMITTED). Réservé aux managers RH/admins côté action.
 */
export function DeleteLeaveButton({
  id, status, days, userLabel
}: {
  id: string;
  status: string;
  days: number;
  userLabel: string;
}) {
  const [pending, start] = useTransition();
  function run() {
    const isApproved = status === "APPROVED";
    const msg = isApproved
      ? `Supprimer la demande validée de ${userLabel} (${days}j) ?\n\nLes ${days} jour(s) retourneront dans son compteur.`
      : `Supprimer la demande de ${userLabel} (${days}j) ?`;
    if (!window.confirm(msg)) return;
    start(async () => {
      try {
        const r = await deleteLeaveRequest(id);
        const restored = (r as any)?.restoredDays ?? 0;
        toast.success(
          restored > 0
            ? `Supprimé — ${restored}j restaurés dans le compteur.`
            : "Demande supprimée."
        );
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <button
      onClick={run}
      disabled={pending}
      className="text-red-600 hover:bg-red-50 rounded p-1"
      title={status === "APPROVED"
        ? "Supprimer et restaurer le solde"
        : "Supprimer la demande"}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
