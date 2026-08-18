"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { generateMissionCashflowAction } from "@/server/actions/mission-execs";
import { isNextControlFlow } from "@/lib/next-errors";

/**
 * Bouton de rattrapage cashflow pour une mission existante. Utile pour
 * les missions contractualisées AVANT la génération automatique, ou
 * après une prolongation qui étend endDate.
 */
export function GenerateCashflowButton({ missionId }: { missionId: string }) {
  const [pending, start] = useTransition();
  function go() {
    start(async () => {
      try {
        const r = await generateMissionCashflowAction(missionId);
        if (r.created === 0) {
          toast.info("Toutes les tranches sont déjà générées.");
        } else {
          toast.success(`${r.created} tranche${r.created > 1 ? "s" : ""} créée${r.created > 1 ? "s" : ""}${r.skipped > 0 ? ` (${r.skipped} déjà présente${r.skipped > 1 ? "s" : ""})` : ""}.`);
        }
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="btn-secondary btn-sm text-xs"
      title="Génère les tranches manquantes du cashflow sur la durée de la mission"
    >
      <Sparkles className="w-3.5 h-3.5" />
      {pending ? "Génération…" : "Générer les tranches manquantes"}
    </button>
  );
}
