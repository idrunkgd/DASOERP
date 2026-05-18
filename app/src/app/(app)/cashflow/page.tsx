import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { computeCashflowYear } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { CashflowGrid } from "./grid";
import { TrendingUp, TrendingDown, Wallet, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CashflowPage({
  searchParams
}: {
  searchParams: { year?: string };
}) {
  await requirePermission("finance.read");

  const year = parseInt(searchParams.year ?? "", 10) || new Date().getFullYear();
  const [data, settings, recurringCats, oneOffCats] = await Promise.all([
    computeCashflowYear(year),
    prisma.cashflowSettings.findUnique({ where: { id: "singleton" } }),
    prisma.recurringExpense.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"]
    }),
    prisma.oneOffCashflowEntry.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"]
    })
  ]);

  // Catégories distinctes utilisées (récurrents + ponctuels), triées
  const categories = Array.from(
    new Set(
      [...recurringCats, ...oneOffCats]
        .map((r) => r.category)
        .filter((c): c is string => !!c && c.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const yearsToShow = [year - 1, year, year + 1];

  return (
    <div>
      <PageHeader
        title="Cashflow prévisionnel"
        subtitle={`Vue annuelle ${year} — revenus auto (BillingMilestones) + dépenses récurrentes + ponctuels + simulations`}
        actions={
          <div className="flex gap-1">
            {yearsToShow.map((y) => (
              <a
                key={y}
                href={`/cashflow?year=${y}`}
                className={`btn-secondary text-sm ${y === year ? "bg-indigoaccent/20 text-indigoaccent border-indigoaccent" : ""}`}
              >
                {y}
              </a>
            ))}
          </div>
        }
      />

      {/* KPIs annuels */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard
          label="Solde initial"
          value={formatCurrency(data.startingBalance)}
          hint={settings?.startingDate ? `au ${settings.startingDate.toISOString().slice(0,10)}` : ""}
          icon={Wallet}
        />
        <KpiCard
          label="Entrées année"
          value={formatCurrency(data.yearTotals.inflow)}
          hint={`+${formatCurrency(data.yearTotals.inflowWithSim - data.yearTotals.inflow)} avec sim.`}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Sorties année"
          value={formatCurrency(data.yearTotals.outflow)}
          hint={`+${formatCurrency(data.yearTotals.outflowWithSim - data.yearTotals.outflow)} avec sim.`}
          icon={TrendingDown}
          tone="danger"
        />
        <KpiCard
          label="Net année"
          value={formatCurrency(data.yearTotals.net)}
          hint={`Avec sim : ${formatCurrency(data.yearTotals.netWithSim)}`}
          icon={Activity}
          tone={data.yearTotals.net >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Solde fin d'année"
          value={formatCurrency(data.yearTotals.endingBalance)}
          hint={`Avec sim : ${formatCurrency(data.yearTotals.endingBalanceWithSim)}`}
          icon={Wallet}
          tone={data.yearTotals.endingBalance >= 0 ? "success" : "danger"}
        />
      </div>

      <CashflowGrid
        data={data}
        startingBalance={data.startingBalance}
        startingDate={settings?.startingDate?.toISOString().slice(0, 10) ?? `${year}-01-01`}
        categories={categories}
      />
    </div>
  );
}
