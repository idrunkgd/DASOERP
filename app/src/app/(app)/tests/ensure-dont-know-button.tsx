"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, HelpCircle } from "lucide-react";
import { ensureDontKnowChoiceEverywhere } from "@/server/actions/tests";

/**
 * Bouton one-shot : ajoute "Je ne sais pas" à toutes les questions de tous
 * les tests qui ne l'ont pas encore. Idempotent — safe à relancer.
 */
export function EnsureDontKnowButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    if (!confirm("Ajouter un choix « Je ne sais pas » à TOUTES les questions des tests qui ne l'ont pas encore ?")) return;
    start(async () => {
      try {
        const r = await ensureDontKnowChoiceEverywhere();
        toast.success(`${r.added} question(s) complétées, ${r.skipped} déjà OK.`);
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <button onClick={run} disabled={pending} className="btn-secondary btn-sm inline-flex items-center gap-1" title="Ajoute un choix « Je ne sais pas » à toutes les questions existantes">
      {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <HelpCircle className="w-3 h-3" />}
      Je ne sais pas (toutes)
    </button>
  );
}
