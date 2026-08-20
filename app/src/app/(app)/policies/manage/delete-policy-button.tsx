"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deletePolicy } from "@/server/actions/policies";
import { isNextControlFlow } from "@/lib/next-errors";

/**
 * Suppression définitive d'une charte + toutes ses versions et signatures.
 * Double confirmation (titre à retaper) pour éviter les clics accidentels
 * sur un document déjà signé par plusieurs personnes.
 */
export function DeletePolicyButton({
  documentId,
  title,
  hasSignatures
}: {
  documentId: string;
  title: string;
  hasSignatures: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    const warn = hasSignatures
      ? `⚠️ "${title}" a des signatures enregistrées. La suppression est DÉFINITIVE et détruit aussi l'audit de signature.\n\nRetape le titre exact pour confirmer :`
      : `Supprimer définitivement "${title}" ?\n\nRetape le titre exact pour confirmer :`;
    const typed = window.prompt(warn);
    if (typed !== title) {
      if (typed !== null) toast.error("Titre incorrect — suppression annulée");
      return;
    }
    start(async () => {
      try {
        await deletePolicy(documentId);
        toast.success("Charte supprimée");
        router.refresh();
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="Supprimer définitivement"
      className="p-1.5 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-800 disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
