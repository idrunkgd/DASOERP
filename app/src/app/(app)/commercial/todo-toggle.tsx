"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Check, Square } from "lucide-react";
import { toggleContactTodoDone } from "@/server/actions/contacts";

/**
 * Case à cocher pour marquer une tâche comme faite / non-faite depuis
 * la timeline commerciale.
 */
export function TodoToggle({ id, done }: { id: string; done: boolean }) {
  const [pending, start] = useTransition();
  function toggle() {
    start(async () => {
      try {
        await toggleContactTodoDone(id, !done);
        toast.success(done ? "Tâche rouverte" : "Tâche terminée");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border " +
        (done
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-midnight-200 bg-white text-midnight-600 hover:border-emerald-400 hover:text-emerald-700")
      }
      title={done ? "Rouvrir la tâche" : "Marquer comme faite"}
    >
      {done ? <Check className="w-3 h-3" /> : <Square className="w-3 h-3" />}
      {done ? "Fait" : "À faire"}
    </button>
  );
}
