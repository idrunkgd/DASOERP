"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Loader2,
  TrendingUp,
  TrendingDown,
  Receipt,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CalendarClock
} from "lucide-react";
import { MONTH_LABELS } from "@/lib/cashflow";
import {
  cycleMonthlyStatus,
  toggleOneOffStatus
} from "@/server/actions/cashflow";
import { setMilestoneStatus } from "@/server/actions/offers";

const MONTHS_LONG = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

type Milestone = {
  id: string;
  label: string;
  amount: number;
  status: string;
  expectedAt: string | null;
  paidAt: string | null;
  companyName: string | null;
  offerId: string | null;
  projectId: string | null;
};

type RecurringWithEntry = {
  recurring: {
    id: string;
    label: string;
    category: string | null;
    defaultAmount: number;
    isIncome: boolean;
    frequency: string;
    paymentMonths: number[];
  };
  entry: {
    id: string;
    amountOverride: number | null;
    status: string;
    paidAt: string | null;
    notes: string | null;
  } | null;
};

type OneOff = {
  id: string;
  label: string;
  category: string | null;
  amount: number;
  kind: string;
  status: string;
  date: string;
  paidAt: string | null;
};

function falsOnMonth(
  frequency: string,
  paymentMonths: number[],
  month: number
): boolean {
  switch (frequency) {
    case "MONTHLY":
      return true;
    case "QUARTERLY":
      return paymentMonths.length
        ? paymentMonths.includes(month)
        : [3, 6, 9, 12].includes(month);
    case "SEMI_ANNUAL":
      return paymentMonths.length
        ? paymentMonths.includes(month)
        : [6, 12].includes(month);
    case "ANNUAL":
      return paymentMonths.length
        ? paymentMonths.includes(month)
        : month === 12;
    case "CUSTOM":
      return paymentMonths.includes(month);
    default:
      return false;
  }
}

export function CurrentMonthPanel({
  year,
  month,
  milestones,
  recurring,
  oneOffs
}: {
  year: number;
  month: number;
  milestones: Milestone[];
  recurring: RecurringWithEntry[];
  oneOffs: OneOff[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Filtre les récurrents qui tombent ce mois selon leur fréquence
  const recurringForMonth = recurring.filter((r) =>
    falsOnMonth(r.recurring.frequency, r.recurring.paymentMonths, month)
  );

  // Sépare encaissements vs sorties
  const incomeMilestones = milestones; // milestones = toujours des revenus
  const recurringIncomes = recurringForMonth.filter(
    (r) => r.recurring.isIncome
  );
  const recurringExpenses = recurringForMonth.filter(
    (r) => !r.recurring.isIncome
  );
  const oneoffIncomes = oneOffs.filter(
    (o) => o.kind === "INCOME"
  );
  const oneoffExpenses = oneOffs.filter(
    (o) => o.kind === "EXPENSE" || o.kind === "COMMITMENT"
  );
  // Simulations exclues du panneau "ce mois-ci" — c'est du suivi réel

  // Calcul des totaux
  const totals = useMemo(() => {
    const sum = (items: number[]) => items.reduce((s, n) => s + n, 0);

    // Encaissements
    const milestonesPaid = sum(
      incomeMilestones.filter((m) => m.status === "PAID").map((m) => m.amount)
    );
    const milestonesPlanned = sum(
      incomeMilestones
        .filter((m) => m.status !== "PAID" && m.status !== "CANCELLED")
        .map((m) => m.amount)
    );
    const recIncomePaid = sum(
      recurringIncomes
        .filter((r) => r.entry?.status === "PAID")
        .map((r) => r.entry?.amountOverride ?? r.recurring.defaultAmount)
    );
    const recIncomePlanned = sum(
      recurringIncomes
        .filter((r) => r.entry?.status !== "PAID" && r.entry?.status !== "SKIPPED")
        .map((r) => r.entry?.amountOverride ?? r.recurring.defaultAmount)
    );
    const ooIncomePaid = sum(
      oneoffIncomes.filter((o) => o.status === "PAID").map((o) => o.amount)
    );
    const ooIncomePlanned = sum(
      oneoffIncomes
        .filter((o) => o.status !== "PAID" && o.status !== "SKIPPED")
        .map((o) => o.amount)
    );

    // Sorties
    const recExpensePaid = sum(
      recurringExpenses
        .filter((r) => r.entry?.status === "PAID")
        .map((r) => r.entry?.amountOverride ?? r.recurring.defaultAmount)
    );
    const recExpensePlanned = sum(
      recurringExpenses
        .filter((r) => r.entry?.status !== "PAID" && r.entry?.status !== "SKIPPED")
        .map((r) => r.entry?.amountOverride ?? r.recurring.defaultAmount)
    );
    const ooExpensePaid = sum(
      oneoffExpenses.filter((o) => o.status === "PAID").map((o) => o.amount)
    );
    const ooExpensePlanned = sum(
      oneoffExpenses
        .filter((o) => o.status !== "PAID" && o.status !== "SKIPPED")
        .map((o) => o.amount)
    );

    return {
      incomePaid: milestonesPaid + recIncomePaid + ooIncomePaid,
      incomeStillToReceive:
        milestonesPlanned + recIncomePlanned + ooIncomePlanned,
      expensePaid: recExpensePaid + ooExpensePaid,
      expenseStillToPay: recExpensePlanned + ooExpensePlanned
    };
  }, [
    incomeMilestones,
    recurringIncomes,
    recurringExpenses,
    oneoffIncomes,
    oneoffExpenses
  ]);

  const totalUnpaidItems =
    incomeMilestones.filter((m) => m.status !== "PAID" && m.status !== "CANCELLED").length +
    recurringForMonth.filter(
      (r) => r.entry?.status !== "PAID" && r.entry?.status !== "SKIPPED"
    ).length +
    oneOffs.filter((o) => o.status !== "PAID" && o.status !== "SKIPPED" && o.kind !== "SIMULATION")
      .length;

  // Navigation mois précédent/suivant (gère les transitions d'année)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <section className="card p-4 mb-6 border-indigo-200 bg-indigo-50/30">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {/* Toggle expand/collapse */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-midnight-600 hover:text-midnight-900 p-0.5"
            aria-label={collapsed ? "Déplier" : "Replier"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Navigation mois */}
          <div className="flex items-center gap-1 bg-white rounded border border-midnight-200 px-1 py-0.5">
            <Link
              href={`/cashflow?year=${prevYear}&month=${prevMonth}`}
              className="p-1 hover:bg-midnight-100 rounded text-midnight-600 hover:text-midnight-900"
              title={`Mois précédent (${MONTHS_LONG[prevMonth - 1]} ${prevYear})`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
            <h2 className="font-semibold text-sm flex items-center gap-1.5 px-1 min-w-[140px] justify-center">
              <Calendar className="w-4 h-4 text-indigo-600" />
              {MONTHS_LONG[month - 1]} {year}
            </h2>
            <Link
              href={`/cashflow?year=${nextYear}&month=${nextMonth}`}
              className="p-1 hover:bg-midnight-100 rounded text-midnight-600 hover:text-midnight-900"
              title={`Mois suivant (${MONTHS_LONG[nextMonth - 1]} ${nextYear})`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!isCurrentMonth && (
            <Link
              href={`/cashflow?year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
              className="text-[11px] text-indigoaccent hover:underline flex items-center gap-1"
              title="Revenir au mois courant"
            >
              <CalendarClock className="w-3 h-3" />
              Aujourd'hui
            </Link>
          )}

          {totalUnpaidItems > 0 && (
            <span className="badge-warning ml-1">
              {totalUnpaidItems} en attente
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <div className="text-midnight-500">À encaisser</div>
            <div className="font-semibold tabular-nums text-emerald-700">
              {fmt(totals.incomeStillToReceive)} €
            </div>
          </div>
          <div className="text-right">
            <div className="text-midnight-500">À payer</div>
            <div className="font-semibold tabular-nums text-red-700">
              {fmt(totals.expenseStillToPay)} €
            </div>
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* COLONNE GAUCHE : ENCAISSEMENTS */}
          <div>
            <SectionHeader
              icon={TrendingUp}
              label="Encaissements"
              tone="emerald"
              paid={totals.incomePaid}
              planned={totals.incomeStillToReceive}
            />
            <div className="space-y-1.5 mt-3">
              {incomeMilestones.length === 0 &&
                recurringIncomes.length === 0 &&
                oneoffIncomes.length === 0 && (
                  <p className="text-xs text-midnight-500 py-2">
                    Aucun encaissement prévu ce mois.
                  </p>
                )}
              {incomeMilestones.map((m) => (
                <MilestoneRow key={m.id} milestone={m} />
              ))}
              {recurringIncomes.map((r) => (
                <RecurringRow
                  key={r.recurring.id}
                  data={r}
                  year={year}
                  month={month}
                />
              ))}
              {oneoffIncomes.map((o) => (
                <OneOffRow key={o.id} oneoff={o} />
              ))}
            </div>
          </div>

          {/* COLONNE DROITE : SORTIES */}
          <div>
            <SectionHeader
              icon={TrendingDown}
              label="Sorties"
              tone="red"
              paid={totals.expensePaid}
              planned={totals.expenseStillToPay}
            />
            <div className="space-y-1.5 mt-3">
              {recurringExpenses.length === 0 &&
                oneoffExpenses.length === 0 && (
                  <p className="text-xs text-midnight-500 py-2">
                    Aucune sortie prévue ce mois.
                  </p>
                )}
              {recurringExpenses.map((r) => (
                <RecurringRow
                  key={r.recurring.id}
                  data={r}
                  year={year}
                  month={month}
                />
              ))}
              {oneoffExpenses.map((o) => (
                <OneOffRow key={o.id} oneoff={o} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  label,
  tone,
  paid,
  planned
}: {
  icon: any;
  label: string;
  tone: "emerald" | "red";
  paid: number;
  planned: number;
}) {
  const total = paid + planned;
  const pct = total > 0 ? (paid / total) * 100 : 0;
  const textColor = tone === "emerald" ? "text-emerald-700" : "text-red-700";
  const barColor = tone === "emerald" ? "bg-emerald-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className={`font-semibold text-sm flex items-center gap-1.5 ${textColor}`}>
          <Icon className="w-4 h-4" />
          {label}
        </h3>
        <div className="text-xs">
          <span className={`font-semibold tabular-nums ${textColor}`}>
            {fmt(paid)}
          </span>
          <span className="text-midnight-400 mx-1">/</span>
          <span className="tabular-nums">{fmt(total)} €</span>
        </div>
      </div>
      <div className="h-1.5 bg-midnight-100 rounded overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function MilestoneRow({ milestone: m }: { milestone: Milestone }) {
  const [pending, start] = useTransition();
  const isPaid = m.status === "PAID";
  const isCancelled = m.status === "CANCELLED";
  return (
    <div
      className={
        "flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white border border-midnight-200 text-sm " +
        (isPaid ? "bg-emerald-50/60 border-emerald-200" : "") +
        (isCancelled ? "opacity-50 line-through" : "")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Receipt className="w-3 h-3 text-midnight-400 shrink-0" />
          {(m.offerId || m.projectId) ? (
            <Link
              href={m.offerId ? `/offers/${m.offerId}` : `/projects/${m.projectId}`}
              className="font-medium truncate hover:underline"
            >
              {m.label}
            </Link>
          ) : (
            <span className="font-medium truncate">{m.label}</span>
          )}
        </div>
        {m.companyName && (
          <div className="text-[10px] text-midnight-500 truncate ml-4">
            {m.companyName}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold tabular-nums text-emerald-700 text-sm">
          {fmt(m.amount)} €
        </div>
      </div>
      <button
        onClick={() => {
          start(async () => {
            try {
              await setMilestoneStatus(m.id, isPaid ? "READY" : "PAID");
              toast.success(isPaid ? "Marqué non encaissé" : "Encaissé ✓");
            } catch (e: any) {
              toast.error(e?.message ?? "Erreur");
            }
          });
        }}
        disabled={pending || isCancelled}
        className={
          "p-1.5 rounded transition-colors " +
          (isPaid
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-midnight-100 text-midnight-500 hover:bg-emerald-100 hover:text-emerald-700")
        }
        title={isPaid ? "Marquer non encaissé" : "Marquer encaissé"}
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function RecurringRow({
  data,
  year,
  month
}: {
  data: RecurringWithEntry;
  year: number;
  month: number;
}) {
  const [pending, start] = useTransition();
  const amount = data.entry?.amountOverride ?? data.recurring.defaultAmount;
  const status = data.entry?.status ?? "PLANNED";
  const isPaid = status === "PAID";
  const isSkipped = status === "SKIPPED";
  if (isSkipped) return null; // n'affiche pas les sautés
  const isIncome = data.recurring.isIncome;
  return (
    <div
      className={
        "flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white border border-midnight-200 text-sm " +
        (isPaid ? "bg-emerald-50/60 border-emerald-200" : "")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{data.recurring.label}</div>
        {data.recurring.category && (
          <div className="text-[10px] text-midnight-500 truncate">
            {data.recurring.category}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div
          className={
            "font-semibold tabular-nums text-sm " +
            (isIncome ? "text-emerald-700" : "text-red-700")
          }
        >
          {fmt(amount)} €
        </div>
      </div>
      <button
        onClick={() => {
          start(async () => {
            try {
              await cycleMonthlyStatus(data.recurring.id, year, month);
              toast.success(isPaid ? "Non payé" : "Payé ✓");
            } catch (e: any) {
              toast.error(e?.message ?? "Erreur");
            }
          });
        }}
        disabled={pending}
        className={
          "p-1.5 rounded transition-colors " +
          (isPaid
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-midnight-100 text-midnight-500 hover:bg-emerald-100 hover:text-emerald-700")
        }
        title={isPaid ? "Annuler le paiement" : "Marquer payé"}
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function OneOffRow({ oneoff: o }: { oneoff: OneOff }) {
  const [pending, start] = useTransition();
  const isPaid = o.status === "PAID";
  const isSkipped = o.status === "SKIPPED";
  if (isSkipped) return null;
  const isIncome = o.kind === "INCOME";
  const isCommitment = o.kind === "COMMITMENT";
  return (
    <div
      className={
        "flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-white border text-sm " +
        (isPaid
          ? "bg-emerald-50/60 border-emerald-200"
          : isCommitment
          ? "border-amber-300 bg-amber-50/40"
          : "border-midnight-200")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {isCommitment && (
            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
          )}
          <span className="font-medium truncate">{o.label}</span>
        </div>
        {o.category && (
          <div className="text-[10px] text-midnight-500 truncate">
            {o.category}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div
          className={
            "font-semibold tabular-nums text-sm " +
            (isIncome ? "text-emerald-700" : "text-red-700")
          }
        >
          {fmt(o.amount)} €
        </div>
      </div>
      <button
        onClick={() => {
          start(async () => {
            try {
              await toggleOneOffStatus(o.id);
              toast.success(isPaid ? "Non payé" : "Payé ✓");
            } catch (e: any) {
              toast.error(e?.message ?? "Erreur");
            }
          });
        }}
        disabled={pending}
        className={
          "p-1.5 rounded transition-colors " +
          (isPaid
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-midnight-100 text-midnight-500 hover:bg-emerald-100 hover:text-emerald-700")
        }
        title={isPaid ? "Annuler le paiement" : "Marquer payé"}
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("fr-BE", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  });
}
