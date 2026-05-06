"use client";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProjectRemainingTime } from "@/server/actions/project-status";

export function RemainingInput({
  projectId,
  initialValue
}: {
  projectId: string;
  initialValue: number;
}) {
  const [value, setValue] = useState<string>(initialValue.toFixed(2));
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const dirty = Number(value) !== Number(initialValue);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || pending) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProjectRemainingTime(fd);
        setSavedAt(Date.now());
        toast.success("Reste à faire mis à jour");
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur lors de la sauvegarde");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5 justify-end">
      <input type="hidden" name="projectId" value={projectId} />
      <input
        name="remainingTimeH"
        type="number"
        min="0"
        step="0.25"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input w-24 text-right tabular-nums py-1 px-2 text-sm"
        disabled={pending}
      />
      <span className="text-xs text-midnight-500">h</span>
      <button
        type="submit"
        disabled={!dirty || pending}
        className="btn-secondary px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        title={dirty ? "Sauvegarder" : "Aucun changement"}
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : savedAt && !dirty ? (
          <Check className="w-3.5 h-3.5 text-emerald-600" />
        ) : (
          "OK"
        )}
      </button>
    </form>
  );
}
