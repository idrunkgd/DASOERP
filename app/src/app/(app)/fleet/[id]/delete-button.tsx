"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { deleteVehicle } from "@/server/actions/fleet";

export function DeleteVehicleButton({ id, plate }: { id: string; plate: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  function del() {
    if (!confirm(`Supprimer définitivement le véhicule ${plate} ?\n\nCascade : contrat leasing + toutes les attributions + ligne cashflow associée.`)) return;
    start(async () => {
      try {
        await deleteVehicle(id);
        toast.success("Véhicule supprimé");
        router.push("/fleet");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <button type="button" onClick={del} disabled={pending} className="btn-ghost text-danger">
      <Trash2 className="w-4 h-4" /> Supprimer
    </button>
  );
}
