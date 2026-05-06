"use client";
import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSalaryScenario } from "@/server/actions/salary-scenarios";

export function DeleteScenarioButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title="Supprimer cette simulation"
      onClick={() => {
        if (!confirm(`Supprimer la simulation « ${label} » ?`)) return;
        start(async () => {
          try {
            await deleteSalaryScenario(id);
            toast.success("Simulation supprimée");
          } catch (e: any) {
            toast.error(e?.message ?? "Erreur lors de la suppression");
          }
        });
      }}
      disabled={pending}
      className="text-red-600 hover:text-red-700 disabled:opacity-40 p-1"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
