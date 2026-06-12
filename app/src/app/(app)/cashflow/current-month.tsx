"use client";
import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
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
import {
  cycleMonthlyStatus,
  toggleOneOffStatus
} from "@/server/actions/cashflow";
import { setMilestoneStatus } from "@/server/actions/offers";
import { colorForCategory, NO_CATEGORY } from "./category-color";

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

/** Type unifié pour l'affichage : tout item (milestone, recurring, oneoff) regroupé par catégorie */
type UnifiedItem = {
  key: string;
  category: string;
  label: string;
  amount: number;
  isPaid: boolean;
  isSkipped: boolean;
  isIncome: boolean;
  // Données pour les actions
  source: "milestone" | "recurring" | "oneoff";
  sourceId: string;
  // Métadonnées d'affichage
  companyName?: string | null;
  offerId?: string | null;
  projectId?: string | null;
  isCommitment?: boolean;
  isCancelled?: boolean;
  // Pour recurring : on a besoin de l'année/mois pour cycleMonthlyStatus
  year?: number;
  monthNum?: number;
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

  // Construction de la liste unifiée d'items
  const { incomeItems, expenseItems } = useMemo(() => {
    const inc: UnifiedItem[] = [];
    const exp: UnifiedItem[] = [];

    // Milestones → toujours revenu, catégorie "Factures clients"
    // Le client est intégré au label entre parenthèses pour cohérence avec
    // la grille annuelle.
    for (const m of milestones) {
      const labelWithCompany = m.companyName
        ? `${m.label} (${m.companyName})`
        : m.label;
      inc.push({
        key: `m-${m.id}`,
        category: "Factures clients",
        label: labelWithCompany,
        amount: m.amount,
        isPaid: m.status === "PAID",
        isSkipped: false,
        isCancelled: m.status === "CANCELLED",
        isIncome: true,
        source: "milestone",
        sourceId: m.id,
        companyName: null, // déjà intégré au label
        offerId: m.offerId,
        projectId: m.projectId
      });
    }

    // Recurring
    for (const r of recurringForMonth) {
      const amount = r.entry?.amountOverride ?? r.recurring.defaultAmount;
      const status = r.entry?.status ?? "PLANNED";
      if (status === "SKIPPED") continue;
      const item: UnifiedItem = {
        key: `r-${r.recurring.id}`,
        category: r.recurring.category?.trim() || NO_CATEGORY,
        label: r.recurring.label,
        amount,
        isPaid: status === "PAID",
        isSkipped: false,
        isIncome: r.recurring.isIncome,
        source: "recurring",
        sourceId: r.recurring.id,
        year,
        monthNum: month
      };
      (r.recurring.isIncome ? inc : exp).push(item);
    }

    // OneOffs : seules les entrées RÉELLES apparaissent dans la vue mensuelle.
    // Les simulations (SIMULATION = dépense what-if, SIMULATION_INCOME = recette
    // hypothétique) sont strictement réservées à la grille annuelle, où elles
    // peuvent être togglées via "Inclure simulations". Ici on ne les voit jamais.
    for (const o of oneOffs) {
      if (o.kind === "SIMULATION" || o.kind === "SIMULATION_INCOME") continue;
      if (o.status === "SKIPPED") continue;
      const item: UnifiedItem = {
        key: `o-${o.id}`,
        category: o.category?.trim() || NO_CATEGORY,
        label: o.label,
        amount: o.amount,
        isPaid: o.status === "PAID",
        isSkipped: false,
        isIncome: o.kind === "INCOME",
        isCommitment: o.kind === "COMMITMENT",
        source: "oneoff",
        sourceId: o.id
      };
      (o.kind === "INCOME" ? inc : exp).push(item);
    }

    return { incomeItems: inc, expenseItems: exp };
  }, [milestones, recurringForMonth, oneOffs, year, month]);

  // Totaux
  const totals = useMemo(() => {
    const sum = (items: UnifiedItem[], paid: boolean) =>
      items
        .filter((i) => i.isPaid === paid && !i.isCancelled)
        .reduce((s, i) => s + i.amount, 0);
    return {
      incomePaid: sum(incomeItems, true),
      incomeStillToReceive: sum(incomeItems, false),
      expensePaid: sum(expenseItems, true),
      expenseStillToPay: sum(expenseItems, false)
    };
  }, [incomeItems, expenseItems]);

  const totalUnpaidItems =
    incomeItems.filter((i) => !i.isPaid && !i.isCancelled).length +
    expenseItems.filter((i) => !i.isPaid).length;

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
          <ColumnByCategory
            label="Encaissements"
            icon={TrendingUp}
            tone="emerald"
            items={incomeItems}
            paid={totals.incomePaid}
            planned={totals.incomeStillToReceive}
          />
          <ColumnByCategory
            label="Sorties"
            icon={TrendingDown}
            tone="red"
            items={expenseItems}
            paid={totals.expensePaid}
            planned={totals.expenseStillToPay}
          />
        </div>
      )}
    </section>
  );
}

// ─────────── Column avec groupement par catégorie ───────────

function ColumnByCategory({
  label,
  icon: Icon,
  tone,
  items,
  paid,
  planned
}: {
  label: string;
  icon: any;
  tone: "emerald" | "red";
  items: UnifiedItem[];
  paid: number;
  planned: number;
}) {
  // État des sous-catégories : par défaut toutes REPLIÉES (cohérent avec
  // la grille annuelle). L'utilisateur déplie ce qu'il veut consulter.
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedItem[]>();
    for (const item of items) {
      const cat = item.category || NO_CATEGORY;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === NO_CATEGORY) return 1;
      if (b === NO_CATEGORY) return -1;
      return a.localeCompare(b);
    });
  }, [items]);

  const textColor = tone === "emerald" ? "text-emerald-700" : "text-red-700";
  const barColor = tone === "emerald" ? "bg-emerald-500" : "bg-red-500";
  const total = paid + planned;
  const pct = total > 0 ? (paid / total) * 100 : 0;

  return (
    <div>
      {/* Header colonne */}
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

      {/* Groupes par catégorie */}
      <div className="space-y-2 mt-3">
        {grouped.length === 0 && (
          <p className="text-xs text-midnight-500 py-2">
            Aucun élément ce mois.
          </p>
        )}
        {grouped.map(([cat, catItems]) => {
          // Par défaut replié : on n'affiche que le header avec les sous-totaux.
          const isCollapsed = collapsedCats[cat] ?? true;
          const catTotal = catItems
            .filter((i) => !i.isCancelled)
            .reduce((s, i) => s + i.amount, 0);
          const catPaid = catItems
            .filter((i) => i.isPaid && !i.isCancelled)
            .reduce((s, i) => s + i.amount, 0);
          const catRemaining = catTotal - catPaid;
          const dotColor =
            cat === NO_CATEGORY ? "bg-midnight-300" : colorForCategory(cat);
          const allPaid = catRemaining === 0 && catItems.length > 0;

          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() =>
                  setCollapsedCats((c) => ({ ...c, [cat]: !c[cat] }))
                }
                className="w-full flex items-center justify-between gap-2 px-2 py-1 bg-white/70 hover:bg-white border border-midnight-200 rounded text-xs"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-midnight-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-midnight-400 shrink-0" />
                  )}
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
                  />
                  <span className="font-semibold text-midnight-700 truncate">
                    {cat}
                  </span>
                  <span className="text-midnight-400 shrink-0">
                    ({catItems.length})
                  </span>
                  {allPaid && (
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                  )}
                </span>
                <span className="shrink-0 tabular-nums">
                  {catRemaining > 0 ? (
                    <>
                      <span className={`font-semibold ${textColor}`}>
                        {fmt(catRemaining)}
                      </span>
                      <span className="text-midnight-400 mx-0.5">/</span>
                      <span className="text-midnight-500">{fmt(catTotal)}</span>
                    </>
                  ) : (
                    <span className="text-emerald-700 font-semibold">
                      {fmt(catTotal)} €
                    </span>
                  )}
                </span>
              </button>
              {!isCollapsed && (
                <div className="space-y-1 mt-1 pl-3">
                  {catItems.map((item) => (
                    <UnifiedItemRow key={item.key} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────── Ligne unifiée ───────────

function UnifiedItemRow({ item }: { item: UnifiedItem }) {
  const [pending, start] = useTransition();
  const { isPaid, isCommitment, isCancelled, isIncome } = item;

  function toggle() {
    if (isCancelled) return;
    start(async () => {
      try {
        if (item.source === "milestone") {
          // Dé-payer une tranche déjà émise = retour à INVOICED (facture
          // existe toujours côté client), pas READY. Sinon la ligne sort
          // du KPI "En cours" qui ne somme que les INVOICED.
          await setMilestoneStatus(item.sourceId, isPaid ? ("INVOICED" as any) : "PAID");
        } else if (item.source === "recurring" && item.year && item.monthNum) {
          await cycleMonthlyStatus(item.sourceId, item.year, item.monthNum);
        } else if (item.source === "oneoff") {
          await toggleOneOffStatus(item.sourceId);
        }
        toast.success(isPaid ? "Non payé (retour à facturé)" : "Payé ✓");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <div
      className={
        "flex items-center justify-between gap-2 px-2 py-1.5 rounded text-sm border " +
        (isPaid
          ? "bg-emerald-50/60 border-emerald-200"
          : isCommitment
          ? "border-amber-300 bg-amber-50/40"
          : "bg-white border-midnight-200") +
        (isCancelled ? " opacity-50 line-through" : "")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {item.source === "milestone" && (
            <Receipt className="w-3 h-3 text-midnight-400 shrink-0" />
          )}
          {isCommitment && (
            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
          )}
          {item.source === "milestone" && (item.offerId || item.projectId) ? (
            <Link
              href={
                item.offerId
                  ? `/offers/${item.offerId}`
                  : `/projects/${item.projectId}`
              }
              className="font-medium truncate hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium truncate">{item.label}</span>
          )}
        </div>
        {item.companyName && (
          <div className="text-[10px] text-midnight-500 truncate ml-4">
            {item.companyName}
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
          {fmt(item.amount)} €
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={pending || isCancelled}
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
