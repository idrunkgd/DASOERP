import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { computeCashflowWeeks } from "@/lib/cashflow-weekly";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  ChevronLeft,
  ChevronRight,
  CalendarRange
} from "lucide-react";
import { WeeklyGrid } from "./grid";

export const dynamic = "force-dynamic";

function parseFromDate(s: string | undefined): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function WeeklyCashflowPage({
  searchParams
}: {
  searchParams: { from?: string };
}) {
  await requirePermission("finance.read");

  const fromDate = parseFromDate(searchParams.from);
  const data = await computeCashflowWeeks(fromDate, 13);

  const prevDate = new Date(fromDate);
  prevDate.setUTCDate(prevDate.getUTCDate() - 7 * 13);
  const nextDate = new Date(fromDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + 7 * 13);
  const todayDate = new Date();
  todayDate.setUTCHours(0, 0, 0, 0);
  const isAtToday =
    todayDate.toISOString().slice(0, 10) ===
    fromDate.toISOString().slice(0, 10);

  const endingBalanceAt13 =
    data.weekTotals[data.weekTotals.length - 1]?.endingBalance ?? 0;
  const minBalance = Math.min(
    data.startingBalance,
    ...data.weekTotals.map((w) => w.endingBalance)
  );

  const dateRangeLabel = `${data.weeks[0].label.split(" ").slice(1).join(" ")} → ${data.weeks[data.weeks.length - 1].label.split(" ").slice(1).join(" ")}`;

  return (
    <div>
      <PageHeader
        title="Cashflow 13 semaines"
        subtitle={`Prévisionnel glissant — ${dateRangeLabel}`}
        actions={
          <div className="flex gap-1 items-center">
            <Link
              href={`/cashflow/13-week?from=${isoDate(prevDate)}`}
              className="btn-secondary text-sm flex items-center gap-1"
              title="13 semaines précédentes"
            >
              <ChevronLeft className="w-4 h-4" />
              -13 sem.
            </Link>
            {!isAtToday && (
              <Link
                href={`/cashflow/13-week?from=${isoDate(todayDate)}`}
                className="btn-secondary text-sm flex items-center gap-1"
              >
                <CalendarRange className="w-4 h-4" />
                Aujourd'hui
              </Link>
            )}
            <Link
              href={`/cashflow/13-week?from=${isoDate(nextDate)}`}
              className="btn-secondary text-sm flex items-center gap-1"
              title="13 semaines suivantes"
            >
              +13 sem.
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link
              href="/cashflow"
              className="btn-secondary text-sm ml-2"
              title="Vue mensuelle annuelle"
            >
              Vue mensuelle
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard
          label="Solde début"
          value={formatCurrency(data.startingBalance)}
          hint={`Au ${data.weeks[0].startDate.toLocaleDateString("fr-BE")}`}
          icon={Wallet}
          tone={data.startingBalance >= 0 ? "neutral" : "danger"}
        />
        <KpiCard
          label="Entrées 13 sem."
          value={formatCurrency(data.totalInflow)}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Sorties 13 sem."
          value={formatCurrency(data.totalOutflow)}
          icon={TrendingDown}
          tone="danger"
        />
        <KpiCard
          label="Net 13 sem."
          value={formatCurrency(data.totalNet)}
          icon={Activity}
          tone={data.totalNet >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Solde fin (S+13)"
          value={formatCurrency(endingBalanceAt13)}
          hint={`Plus bas projeté : ${formatCurrency(minBalance)}`}
          icon={Wallet}
          tone={
            endingBalanceAt13 >= 0
              ? minBalance >= 0
                ? "success"
                : "warning"
              : "danger"
          }
        />
      </div>

      <WeeklyGrid data={data} />

      <p className="text-xs text-midnight-500 mt-4">
        Vue read-only — pour marquer un encaissement / paiement, passe par la{" "}
        <Link href="/cashflow" className="text-indigoaccent hover:underline">
          vue mensuelle
        </Link>
        . Les récurrents sont positionnés au 1<sup>er</sup> du mois (approximation).
        Les recettes sont affichées en TVAC.
      </p>
    </div>
  );
}
