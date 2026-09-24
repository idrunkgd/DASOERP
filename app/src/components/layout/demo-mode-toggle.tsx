"use client";
/**
 * Bouton Mode démo dans le sidebar — bascule l'impersonation de Jean Démo.
 * Visible uniquement pour les Admin/Manager. Voir server/actions/demo-mode.ts.
 */
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { enableDemoMode, disableDemoMode } from "@/server/actions/demo-mode";
import { Play, Square } from "lucide-react";

export function DemoModeToggle({ active, allowed }: { active: boolean; allowed: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!allowed && !active) return null;

  const handleToggle = () => {
    start(async () => {
      try {
        if (active) await disableDemoMode();
        else await enableDemoMode();
        router.refresh();
      } catch (e) {
        alert((e as Error).message);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={[
        "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition",
        active
          ? "bg-amber-500 text-white hover:bg-amber-600"
          : "bg-white/5 text-indigo-100 hover:bg-white/10 border border-white/10"
      ].join(" ")}
      title={active
        ? "Vous êtes en train d'impersonner Jean Démo. Cliquez pour revenir à votre compte."
        : "Devenir Jean Démo temporairement — pour montrer le HUB à un employé."
      }
    >
      {active ? (
        <>
          <Square className="w-3.5 h-3.5" />
          <span>Sortir du mode démo</span>
        </>
      ) : (
        <>
          <Play className="w-3.5 h-3.5" />
          <span>Mode démo</span>
        </>
      )}
    </button>
  );
}
