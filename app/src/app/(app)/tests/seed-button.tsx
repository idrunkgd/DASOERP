"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { seedTestsIfMissing } from "@/server/actions/tests";

export function SeedButton() {
  const [pending, start] = useTransition();
  function go() {
    start(async () => {
      try {
        const r = await seedTestsIfMissing();
        toast.success(r.message);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur lors du seed");
      }
    });
  }
  return (
    <button onClick={go} disabled={pending} className="btn-primary">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      Initialiser les 5 tests
    </button>
  );
}
