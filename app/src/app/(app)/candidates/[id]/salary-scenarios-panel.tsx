"use client";
import Link from "next/link";
import { useTransition } from "react";
import { Calculator, Plus, Trash2, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  deleteSalaryScenario,
  applyScenarioToCandidate
} from "@/server/actions/salary-scenarios";
import { formatCurrency, formatDate } from "@/lib/utils";

export type ScenarioRow = {
  id: string;
  label: string;
  grossMonthly: number;
  workingDaysPerWeek: number;
  totalAnnualCost: number;
  costPerDay: number;
  billableRate: number;
  soldDailyRate: number;
  targetMarginPct: number;
  createdAt: string;
  createdBy: { firstName: string; lastName: string } | null;
};

export function SalaryScenariosPanel({
  candidateId,
  scenarios,
  canApply,
  candidateCurrentDailyCost
}: {
  candidateId: string;
  scenarios: ScenarioRow[];
  canApply: boolean;
  candidateCurrentDailyCost: number | null;
}) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <Calculator className="w-4 h-4" /> Simulations de package (
          {scenarios.length})
        </h2>
        <Link
          href={`/salary-simulator?candidate=${candidateId}`}
          className="btn-secondary text-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Nouvelle simulation
        </Link>
      </div>

      {scenarios.length === 0 ? (
        <div className="text-sm text-midnight-500 py-2">
          Aucune simulation pour ce candidat.{" "}
          <Link
            href={`/salary-simulator?candidate=${candidateId}`}
            className="text-indigoaccent hover:underline"
          >
            Créer une simulation
          </Link>{" "}
          à partir du brut demandé pour calculer son coût journalier.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Libellé</th>
                <th className="text-right">Brut/mois</th>
                <th>Régime</th>
                <th className="text-right">Coût/an</th>
                <th className="text-right">TJM coût</th>
                <th className="text-right">TJM vendu</th>
                <th className="text-right">Marge</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const margin =
                  s.soldDailyRate > 0
                    ? s.soldDailyRate - s.costPerDay
                    : s.billableRate - s.costPerDay;
                const marginPct =
                  s.costPerDay > 0
                    ? ((s.soldDailyRate > 0
                        ? s.soldDailyRate - s.costPerDay
                        : s.billableRate - s.costPerDay) /
                        s.costPerDay) *
                      100
                    : 0;
                const isReal = s.soldDailyRate > 0;
                return (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/salary-simulator?scenario=${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.label}
                      </Link>
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(s.grossMonthly)}
                    </td>
                    <td className="text-xs">{s.workingDaysPerWeek}/5</td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(s.totalAnnualCost)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(s.costPerDay)}
                    </td>
                    <td className="text-right tabular-nums">
                      {isReal ? (
                        <span className="font-semibold text-emerald-700">
                          {formatCurrency(s.soldDailyRate)}
                        </span>
                      ) : (
                        <span className="text-midnight-400 text-xs italic">
                          suggéré : {formatCurrency(s.billableRate)}
                        </span>
                      )}
                    </td>
                    <td
                      className={`text-right tabular-nums text-xs ${
                        margin >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {margin >= 0 ? "+" : ""}
                      {formatCurrency(margin)}
                      <div className="text-[10px]">
                        {marginPct >= 0 ? "+" : ""}
                        {marginPct.toFixed(0)}%
                      </div>
                    </td>
                    <td className="text-xs text-midnight-500">
                      <div>{formatDate(s.createdAt)}</div>
                      {s.createdBy && (
                        <div className="text-[10px]">
                          {s.createdBy.firstName} {s.createdBy.lastName[0]}.
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        {canApply && (
                          <ApplyButton
                            scenarioId={s.id}
                            label={s.label}
                            costPerDay={s.costPerDay}
                            currentCost={candidateCurrentDailyCost}
                          />
                        )}
                        <Link
                          href={`/salary-simulator?scenario=${s.id}`}
                          className="text-midnight-500 hover:text-indigoaccent p-1"
                          title="Charger dans le simulateur"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <DeleteButton id={s.id} label={s.label} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {scenarios.length > 0 && canApply && (
        <p className="text-[11px] text-midnight-500 mt-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3" />
          Le bouton ✓ applique le TJM coût et le TJM facturable de la simulation
          comme tarifs officiels du candidat (Coût/j et Tarif min souhaité).
        </p>
      )}
    </section>
  );
}

function ApplyButton({
  scenarioId,
  label,
  costPerDay,
  currentCost
}: {
  scenarioId: string;
  label: string;
  costPerDay: number;
  currentCost: number | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title="Appliquer ces tarifs au candidat"
      onClick={() => {
        const msg = currentCost
          ? `Remplacer le coût actuel ${currentCost.toFixed(0)}€ → ${costPerDay.toFixed(0)}€ avec la simulation « ${label} » ?`
          : `Appliquer le coût ${costPerDay.toFixed(0)}€/j depuis la simulation « ${label} » ?`;
        if (!confirm(msg)) return;
        start(async () => {
          try {
            await applyScenarioToCandidate(scenarioId);
            toast.success("Tarifs appliqués sur la fiche candidat");
            router.refresh();
          } catch (e: any) {
            toast.error(e?.message ?? "Erreur");
          }
        });
      }}
      disabled={pending}
      className="text-emerald-700 hover:text-emerald-800 disabled:opacity-40 p-1"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

function DeleteButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title="Supprimer cette simulation"
      onClick={() => {
        if (!confirm(`Supprimer la simulation « ${label} » ?`)) return;
        start(async () => {
          try {
            await deleteSalaryScenario(id);
            toast.success("Simulation supprimée");
          } catch (e: any) {
            toast.error(e?.message ?? "Erreur");
          }
        });
      }}
      disabled={pending}
      className="text-red-600 hover:text-red-700 disabled:opacity-40 p-1"
    >
      {pending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
