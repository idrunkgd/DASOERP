"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { deleteAllPendingAssignments } from "@/server/actions/tests";

/**
 * Bouton "Tout supprimer" les affectations non soumises d'un test.
 * Les affectations COMPLETED (soumises, avec score) sont PRÉSERVÉES.
 */
export function DeleteAllAssignmentsButton({
  testId, pendingCount
}: {
  testId: string;
  pendingCount: number;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function run() {
    if (pendingCount === 0) return;
    if (!confirm(`Supprimer les ${pendingCount} affectation(s) non soumises de ce test ? Les tests déjà soumis (avec score) sont préservés.`)) return;
    start(async () => {
      try {
        const r = await deleteAllPendingAssignments(testId);
        toast.success(`${r.count} affectation(s) supprimée(s)`);
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur suppression");
      }
    });
  }

  if (pendingCount === 0) return null;
  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1"
    >
      {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      Supprimer les {pendingCount} non soumises
    </button>
  );
}
