"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Plus, RotateCw, CheckCircle2 } from "lucide-react";
import { rolloverLeaveYear, rolloverLeaveYearAll } from "@/server/actions/leave-requests";

/** Bouton pour un consultant précis — désactivé si les soldes N+1 existent déjà */
export function RolloverOneButton({
  userId,
  nextYear,
  disabled
}: {
  userId: string;
  nextYear: number;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  if (disabled) {
    return (
      <span
        className="text-[10px] text-emerald-700 flex items-center gap-0.5"
        title={`Les soldes ${nextYear} existent déjà`}
      >
        <CheckCircle2 className="w-3 h-3" /> {nextYear} OK
      </span>
    );
  }
  return (
    <button
      onClick={() => {
        if (!confirm(
          `Créer les soldes ${nextYear} pour ce consultant ? Les jours restants de ${nextYear - 1} seront reportés dans "Année précédente".`
        )) return;
        start(async () => {
          try {
            await rolloverLeaveYear(userId, nextYear);
            toast.success(`Soldes ${nextYear} créés ✓`);
          } catch (e: any) {
            toast.error(e?.message ?? "Erreur");
          }
        });
      }}
      disabled={pending}
      className="text-xs text-indigoaccent hover:underline flex items-center gap-0.5"
      title={`Créer les soldes ${nextYear}`}
    >
      <Plus className="w-3 h-3" /> {nextYear}
    </button>
  );
}

/** Bouton principal RH : rollover tous les users actifs en une fois */
export function RolloverAllButton({ nextYear }: { nextYear: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm(
          `Créer les soldes ${nextYear} pour TOUS les consultants actifs ?\n\n` +
          `• Nouveaux quotas Légaux + RTT selon la fiche de chacun\n` +
          `• Les jours restants de ${nextYear - 1} sont reportés en "Année précédente"\n` +
          `• Idempotent : ceux qui ont déjà leurs soldes ${nextYear} sont ignorés\n\n` +
          `Continuer ?`
        )) return;
        start(async () => {
          try {
            const res = await rolloverLeaveYearAll(nextYear);
            toast.success(
              `Soldes ${nextYear} : ${res.succeeded}/${res.total} réussis` +
              (res.failed > 0 ? ` (${res.failed} déjà à jour)` : "")
            );
          } catch (e: any) {
            toast.error(e?.message ?? "Erreur");
          }
        });
      }}
      disabled={pending}
      className="btn-primary text-sm"
    >
      <RotateCw className={"w-3.5 h-3.5 " + (pending ? "animate-spin" : "")} />
      Ajouter congés {nextYear} (tous)
    </button>
  );
}
