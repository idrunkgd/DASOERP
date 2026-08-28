"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { importCourseFromSeed } from "@/server/actions/training";
import { isNextControlFlow } from "@/lib/next-errors";

export function ImportAvevaButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  function importIt() {
    if (!confirm("Importer / rafraîchir la formation AVEVA depuis le fichier bundle ? Les slides existantes seront remplacées.")) return;
    start(async () => {
      try {
        const r = await importCourseFromSeed("aveva-system-platform-2023");
        toast.success(`${r.slides} slides importées`);
        router.refresh();
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <button onClick={importIt} disabled={pending} className="btn-secondary text-sm inline-flex items-center gap-1">
      <Download className="w-4 h-4" /> {pending ? "Import…" : "Importer la formation AVEVA"}
    </button>
  );
}
