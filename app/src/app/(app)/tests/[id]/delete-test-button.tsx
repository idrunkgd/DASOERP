"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { deleteTest } from "@/server/actions/tests";

export function DeleteTestButton({ testId, title }: { testId: string; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function go() {
    const ok = confirm(
      `Supprimer définitivement le test « ${title} » ?\n\n` +
      `Cette action est irréversible. Tu ne peux supprimer un test que s'il n'a aucune assignation. ` +
      `Sinon désassigne les candidats d'abord ou désactive le test.`
    );
    if (!ok) return;
    start(async () => {
      try {
        await deleteTest(testId);
        toast.success("Test supprimé");
        router.push("/tests");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <button
      onClick={go}
      disabled={pending}
      className="btn-ghost text-red-600 hover:bg-red-50 btn-sm"
    >
      {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
      Supprimer
    </button>
  );
}
