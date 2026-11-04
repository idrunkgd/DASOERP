"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Workflow } from "lucide-react";
import { migrateAllPortalsToV2 } from "@/server/actions/client-portals";

export function MigrateAllToV2Button({ count }: { count: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!window.confirm(
          `Basculer les ${count} portail${count > 1 ? "s" : ""} LEGACY actif${count > 1 ? "s" : ""} vers le workflow V2 ?\n\n` +
          `Les propositions au statut 'Entretien demandé' passeront en 'Entretien 1 demandé'. ` +
          `Les clients verront immédiatement la nouvelle interface multi-étapes.`
        )) return;
        start(async () => {
          try {
            const r = await migrateAllPortalsToV2();
            toast.success(`${r.portals.length} portail${r.portals.length > 1 ? "s" : ""} migré${r.portals.length > 1 ? "s" : ""} en V2`);
          } catch (e: any) {
            toast.error(e.message);
          }
        });
      }}
      disabled={pending}
      className="btn-secondary flex items-center gap-2 text-amber-700 border border-amber-300"
    >
      <Workflow className="w-4 h-4" />
      {pending ? "Migration…" : `Migrer ${count} LEGACY → V2`}
    </button>
  );
}
