"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { approveLeaveRequest } from "@/server/actions/leave-requests";

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
