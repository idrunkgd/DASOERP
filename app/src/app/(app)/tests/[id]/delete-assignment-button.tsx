"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { deleteTestAssignment, resetTestAssignment } from "@/server/actions/tests";

/**
 * Actions admin sur une affectation (assignation) d'un test :
 *  - Reset : efface la soumission et repasse en PENDING pour que la personne
 *    refasse le test (conserve le magicToken).
 *  - Supprimer : supprime complètement l'affectation. Désactivé si le test
 *    a été soumis — l'admin doit reset ou passer par /tests/submissions.
 */
export function DeleteAssignmentButton({
  assignmentId, targetName, canDelete = true, canReset
}: {
  assignmentId: string;
  targetName: string;
  canDelete?: boolean;
  canReset?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function doDelete() {
    if (!canDelete) return;
    if (!confirm(`Supprimer l'affectation de ${targetName} ? Toutes les réponses et le score éventuel seront perdus.`)) return;
    start(async () => {
      try {
        await deleteTestAssignment(assignmentId);
        toast.success("Affectation supprimée");
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur suppression");
      }
    });
  }

  function doReset() {
    if (!canReset) return;
    if (!confirm(`Réinitialiser le test pour ${targetName} ? La personne pourra recommencer, le score actuel sera effacé.`)) return;
    start(async () => {
      try {
        await resetTestAssignment(assignmentId);
        toast.success("Test réinitialisé — la personne peut recommencer");
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur réinitialisation");
      }
    });
  }

  return (
    <div className="flex items-center gap-0.5">
      {canReset && (
        <button
          type="button"
          onClick={doReset}
          disabled={pending}
          title={`Réinitialiser le test pour ${targetName}`}
          className="text-xs text-amber-700 hover:text-amber-800 disabled:opacity-40 inline-flex items-center gap-1 p-1 rounded hover:bg-amber-50"
        >
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
        </button>
      )}
      <button
        type="button"
        onClick={doDelete}
        disabled={pending || !canDelete}
        title={canDelete ? "Supprimer l'affectation" : "Affectation soumise — utilise le bouton Reset ou /tests/submissions"}
        className="text-xs text-rose-600 hover:text-rose-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 p-1 rounded hover:bg-rose-50"
      >
        {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      </button>
    </div>
  );
}
