"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteSickLeave } from "@/server/actions/sick-leave";

export function DeleteSickLeaveButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Supprimer cet arrêt ?")) return;
        start(async () => {
          try {
            await deleteSickLeave(id);
            toast.success("Supprimé");
          } catch (e: any) {
            toast.error(e?.message ?? "Erreur");
          }
        });
      }}
      disabled={pending}
      className="text-midnight-400 hover:text-red-600 hover:bg-red-50 rounded p-1"
      title="Supprimer"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
