import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { computeCashflowYear } from "@/lib/cashflow";
import { formatCurrency } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { CashflowGrid } from "./grid";
import { CurrentMonthPanel } from "./current-month";
import { EditableBalanceKpi } from "./editable-balance-kpi";
import { TrendingUp, TrendingDown, Wallet, Activity, Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CashflowPage({
  searchParams
}: {
  searchParams: { year?: string; month?: string };
}) {
  await requirePermission("finance.read");

  const year =
    parseInt(searchParams.year ?? "", 10) || new Date().getFullYear();
  const [data, settings, recurringCats, oneOffCats, missions] = await Promise.all([
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
    }),
    // Missions actives ou en cours — pour facturation T&M (jours × taux)
    prisma.mission.findMany({
      where: {
        status: { in: ["ACTIVE", "EXTENDED", "PLANNED"] }
      },
      include: {
        company: { select: { name: true } },
        consultant: { select: { firstName: true, lastName: true } }
      },
      orderBy: { startDate: "desc" }
    })
  ]);

  // Catégories distinctes utilisées (récurrents + ponctuels)
  const categories = Array.from(
    new Set(
      [...recurringCats, ...oneOffCats]
        .map((r) => r.category)
        .filter((c): c is string => !!c && c.trim().length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  const yearsToShow = [year - 1, year, year + 1];

  // ─── Pour le panneau "Ce mois-ci" : on récupère les détails individuels du mois focus ───
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  // Mois explicitement demandé via URL, ou mois courant si année actuelle, ou janvier sinon
  const monthFromUrl = parseInt(searchParams.month ?? "", 10);
  const focusMonth =
    monthFromUrl >= 1 && monthFromUrl <= 12
      ? monthFromUrl
      : isCurrentYear
      ? now.getMonth() + 1
      : 1;
  const focusMonthStart = new Date(Date.UTC(year, focusMonth - 1, 1));
  const focusMonthEnd = new Date(Date.UTC(year, focusMonth, 0, 23, 59, 59));

  const [milestonesThisMonth, recurringForMonth, recurringMonthEntries, oneOffsThisMonth] =
    await Promise.all([
      prisma.billingMilestone.findMany({
        where: { expectedAt: { gte: focusMonthStart, lte: focusMonthEnd } },
        include: {
          company: { select: { name: true } },
          offer: { include: { company: { select: { name: true } } } },
          project: { include: { company: { select: { name: true } } } }
        },
        orderBy: { expectedAt: "asc" }
      }),
      prisma.recurringExpense.findMany({
        where: { isActive: true },
        orderBy: [{ isIncome: "desc" }, { label: "asc" }]
      }),
      prisma.recurringExpenseMonth.findMany({
        where: { year, month: focusMonth }
      }),
      prisma.oneOffCashflowEntry.findMany({
        where: { date: { gte: focusMonthStart, lte: focusMonthEnd } },
        orderBy: [{ kind: "asc" }, { date: "asc" }]
      })
    ]);

  // ─── TVAC pour les milestones du mois ───
  // Les BillingMilestones stockent leur amount en HTVA. Le panneau "Ce mois-ci"
  // (et donc le résumé "À encaisser / À payer") doivent afficher TVAC pour
  // matcher le compte bancaire et le tableau annuel.
  // Pour les milestones liés à une mission : on prend Mission.vatRate (raw SQL
  // car la colonne n'est pas dans le schéma Prisma — cf. cashflow.ts).
  // Pour les milestones standalone : fallback 21% TVA belge.
  const STANDALONE_VAT_RATE = 21;
  const missionIdsForMonth = Array.from(
    new Set(
      milestonesThisMonth
        .map((m) => m.missionId)
        .filter((id): id is string => !!id)
    )
  );
  const vatRateByMissionId = new Map<string, number>();
  if (missionIdsForMonth.length > 0) {
    try {
      const rows = await prisma.$queryRawUnsafe<
        { id: string; vatRate: string | number }[]
      >(
        `SELECT id, "vatRate" FROM "Mission" WHERE id IN (${missionIdsForMonth.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`
      );
      for (const r of rows) {
        const v = Number(r.vatRate);
        if (Number.isFinite(v)) vatRateByMissionId.set(r.id, v);
      }
    } catch {
      // Si la colonne vatRate n'existe pas encore : on tombe sur 21% par défaut
    }
  }
  const tvacForMilestone = (m: { amount: any; missionId: string | null }) => {
    const vat = m.missionId
      ? vatRateByMissionId.get(m.missionId) ?? STANDALONE_VAT_RATE
      : STANDALONE_VAT_RATE;
    return Math.round(Number(m.amount) * (1 + vat / 100) * 100) / 100;
  };

  return (
    <div>
      <PageHeader
        title="Cashflow prévisionnel"
        subtitle={`Vue annuelle ${year} — revenus auto (BillingMilestones) + dépenses récurrentes + ponctuels + simulations`}
        actions={
          <div className="flex gap-1 items-center flex-wrap">
            {yearsToShow.map((y) => (
              <a
                key={y}
                href={`/cashflow?year=${y}`}
                className={`btn-secondary text-sm ${y === year ? "bg-indigoaccent/20 text-indigoaccent border-indigoaccent" : ""}`}
              >
                {y}
              </a>
            ))}
            <a
              href="/cashflow/13-week"
              className="btn-secondary text-sm ml-2"
              title="Vue prévisionnelle 13 semaines glissantes"
            >
              Vue 13 sem.
            </a>
          </div>
        }
      />

      {/* KPIs annuels */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <EditableBalanceKpi
          initialBalance={data.startingBalance}
          startingDate={
            settings?.startingDate?.toISOString().slice(0, 10) ?? `${year}-01-01`
          }
          isBootstrapYear={data.isBootstrapYear}
          bootstrapYear={data.bootstrapYear}
          displayedYear={year}
        />
        <KpiCard
          label="Solde compte"
          value={formatCurrency(data.yearTotals.realBankBalance)}
          hint={`+${formatCurrency(data.yearTotals.realPaidInflow)} − ${formatCurrency(data.yearTotals.realPaidOutflow)} marqués payés`}
          icon={Banknote}
          tone={data.yearTotals.realBankBalance >= 0 ? "success" : "danger"}
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

      {/* Panneau "Ce mois-ci" */}
      <CurrentMonthPanel
        year={year}
        month={focusMonth}
        milestones={milestonesThisMonth.map((m) => ({
          id: m.id,
          label: m.label,
          amount: tvacForMilestone(m),
          status: m.status,
          expectedAt: m.expectedAt?.toISOString() ?? null,
          paidAt: m.paidAt?.toISOString() ?? null,
          companyName:
            m.company?.name ??
            m.offer?.company?.name ??
            m.project?.company?.name ??
            null,
          offerId: m.offerId,
          projectId: m.projectId
        }))}
        recurring={recurringForMonth
          .map((r) => {
            const entry = recurringMonthEntries.find(
              (e) => e.recurringExpenseId === r.id
            );
            return {
              recurring: {
                id: r.id,
                label: r.label,
                category: r.category,
                defaultAmount: Number(r.defaultAmount),
                isIncome: r.isIncome,
                frequency: r.frequency,
                paymentMonths: r.paymentMonths
              },
              entry: entry
                ? {
                    id: entry.id,
                    amountOverride: entry.amountOverride
                      ? Number(entry.amountOverride)
                      : null,
                    status: entry.status,
                    paidAt: entry.paidAt?.toISOString() ?? null,
                    notes: entry.notes
                  }
                : null
            };
          })}
        oneOffs={oneOffsThisMonth.map((o) => ({
          id: o.id,
          label: o.label,
          category: o.category,
          amount: Number(o.amount),
          kind: o.kind,
          status: o.status,
          date: o.date.toISOString(),
          paidAt: o.paidAt?.toISOString() ?? null
        }))}
      />

      <CashflowGrid
        data={data}
        startingBalance={data.startingBalance}
        startingDate={
          settings?.startingDate?.toISOString().slice(0, 10) ?? `${year}-01-01`
        }
        categories={categories}
        missions={missions.map((m) => ({
          id: m.id,
          reference: m.reference,
          title: m.title,
          dailyRate: Number(m.dailyRate),
          companyName: m.company?.name ?? null,
          consultantName: m.consultant
            ? `${m.consultant.firstName} ${m.consultant.lastName}`
            : null
        }))}
      />
    </div>
  );
}
