"use client";
import { Fragment, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileSignature,
  Loader2,
  Eraser
} from "lucide-react";
import {
  type CashflowYear,
  type CashflowRow,
  MONTH_LABELS
} from "@/lib/cashflow";
import { CategoryInput } from "@/components/forms/category-input";
import {
  upsertCashflowSettings,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  upsertMonthlyEntry,
  cycleMonthlyStatus,
  createOneOffEntry,
  updateOneOffEntry,
  deleteOneOffEntry,
  toggleOneOffStatus,
  cleanupCashflowBefore
} from "@/server/actions/cashflow";

type SectionKey =
  | "income"
  | "recurring_expense"
  | "oneoff"
  | "commitment"
  | "simulation";

const SECTION_LABELS: Record<SectionKey, string> = {
  income: "Revenus",
  recurring_expense: "Dépenses récurrentes",
  oneoff: "Dépenses ponctuelles",
  commitment: "Engagements futurs",
  simulation: "Simulations (what-if)"
};

export function CashflowGrid({
  data,
  startingBalance,
  startingDate,
  categories
}: {
  data: CashflowYear;
  startingBalance: number;
  startingDate: string;
  categories: string[];
}) {
  const [includeSim, setIncludeSim] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    monthIdx: number;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [showNewRecurring, setShowNewRecurring] = useState(false);
  const [showNewOneOff, setShowNewOneOff] = useState<{
    open: boolean;
    kind: "EXPENSE" | "INCOME" | "COMMITMENT" | "SIMULATION";
  }>({ open: false, kind: "EXPENSE" });
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [editingOneOffId, setEditingOneOffId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    income: false,
    recurring_expense: false,
    oneoff: false,
    commitment: false,
    simulation: false
  });

  // Regroupe les rows par section
  const sections = useMemo(() => {
    const groups: Record<SectionKey, CashflowRow[]> = {
      income: [],
      recurring_expense: [],
      oneoff: [],
      commitment: [],
      simulation: []
    };
    for (const r of data.rows) {
      if (
        r.kind === "milestones" ||
        r.kind === "recurring_income" ||
        r.kind === "oneoff_income"
      ) {
        groups.income.push(r);
      } else if (r.kind === "recurring_expense") {
        groups.recurring_expense.push(r);
      } else if (r.kind === "oneoff_expense") {
        groups.oneoff.push(r);
      } else if (r.kind === "commitment") {
        groups.commitment.push(r);
      } else if (r.kind === "simulation") {
        groups.simulation.push(r);
      }
    }
    return groups;
  }, [data]);

  const monthlyTotals = includeSim
    ? data.monthlyTotals.map((m) => ({
        in: m.inflowWithSim,
        out: m.outflowWithSim,
        net: m.netWithSim,
        cum: m.cumulativeBalanceWithSim
      }))
    : data.monthlyTotals.map((m) => ({
        in: m.inflow,
        out: m.outflow,
        net: m.net,
        cum: m.cumulativeBalance
      }));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="btn-secondary text-sm"
          >
            <SettingsIcon className="w-4 h-4" /> Solde initial
          </button>
          <button
            onClick={() => setShowCleanup(true)}
            className="btn-secondary text-sm"
            title="Marque tous les mois avant une date comme « Sauté » et supprime les one-offs antérieurs"
          >
            <Eraser className="w-4 h-4" /> Démarrer à partir de…
          </button>
          <button
            onClick={() => setShowNewRecurring(true)}
            className="btn-secondary text-sm"
          >
            <Plus className="w-4 h-4" /> Récurrent
          </button>
          <button
            onClick={() =>
              setShowNewOneOff({ open: true, kind: "EXPENSE" })
            }
            className="btn-secondary text-sm"
          >
            <Plus className="w-4 h-4" /> Dépense ponctuelle
          </button>
          <button
            onClick={() =>
              setShowNewOneOff({ open: true, kind: "INCOME" })
            }
            className="btn-secondary text-sm"
          >
            <Plus className="w-4 h-4" /> Recette manuelle
          </button>
          <button
            onClick={() =>
              setShowNewOneOff({ open: true, kind: "COMMITMENT" })
            }
            className="btn-secondary text-sm"
          >
            <FileSignature className="w-4 h-4" /> Engagement
          </button>
          <button
            onClick={() =>
              setShowNewOneOff({ open: true, kind: "SIMULATION" })
            }
            className="btn-secondary text-sm"
          >
            <Sparkles className="w-4 h-4" /> Simulation
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeSim}
            onChange={(e) => setIncludeSim(e.target.checked)}
          />
          {includeSim ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
          Inclure les simulations dans les totaux
        </label>
      </div>

      {/* Grille principale */}
      <div className="card overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[900px]">
          <thead className="bg-midnight-50 sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-2 min-w-[200px] sticky left-0 bg-midnight-50 z-20">
                Ligne
              </th>
              {MONTH_LABELS.map((m, i) => (
                <th
                  key={m}
                  className="text-right px-2 py-2 min-w-[78px] font-medium text-midnight-700"
                >
                  {m}
                </th>
              ))}
              <th className="text-right px-3 py-2 min-w-[90px] bg-midnight-100">
                Total
              </th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(SECTION_LABELS) as SectionKey[]).map((sectionKey) => {
              const rowsInSection = sections[sectionKey];
              const isCollapsed = collapsed[sectionKey];
              return (
                <SectionBlock
                  key={sectionKey}
                  sectionKey={sectionKey}
                  rows={rowsInSection}
                  isCollapsed={isCollapsed}
                  onToggle={() =>
                    setCollapsed((c) => ({ ...c, [sectionKey]: !c[sectionKey] }))
                  }
                  editingCell={editingCell}
                  setEditingCell={setEditingCell}
                  setEditingRecId={setEditingRecId}
                  setEditingOneOffId={setEditingOneOffId}
                  year={data.year}
                />
              );
            })}
          </tbody>
          <tfoot className="bg-midnight-50 font-semibold sticky bottom-0">
            <tr className="border-t-2 border-midnight-300">
              <td className="px-3 py-2 sticky left-0 bg-midnight-50">
                Total entrées
              </td>
              {monthlyTotals.map((m, i) => (
                <td
                  key={i}
                  className="text-right tabular-nums text-emerald-700 px-2 py-1"
                >
                  {fmtShort(m.in)}
                </td>
              ))}
              <td className="text-right tabular-nums text-emerald-700 px-3 bg-midnight-100">
                {fmtShort(monthlyTotals.reduce((s, m) => s + m.in, 0))}
              </td>
              <td></td>
            </tr>
            <tr>
              <td className="px-3 py-2 sticky left-0 bg-midnight-50">
                Total sorties
              </td>
              {monthlyTotals.map((m, i) => (
                <td
                  key={i}
                  className="text-right tabular-nums text-red-700 px-2 py-1"
                >
                  {fmtShort(m.out)}
                </td>
              ))}
              <td className="text-right tabular-nums text-red-700 px-3 bg-midnight-100">
                {fmtShort(monthlyTotals.reduce((s, m) => s + m.out, 0))}
              </td>
              <td></td>
            </tr>
            <tr className="border-t border-midnight-300">
              <td className="px-3 py-2 sticky left-0 bg-midnight-50">
                Net du mois
              </td>
              {monthlyTotals.map((m, i) => (
                <td
                  key={i}
                  className={
                    "text-right tabular-nums px-2 py-1 " +
                    (m.net >= 0 ? "text-emerald-700" : "text-red-700")
                  }
                >
                  {fmtShort(m.net)}
                </td>
              ))}
              <td className="text-right tabular-nums px-3 bg-midnight-100">
                {fmtShort(monthlyTotals.reduce((s, m) => s + m.net, 0))}
              </td>
              <td></td>
            </tr>
            <tr className="bg-indigo-50">
              <td className="px-3 py-2 sticky left-0 bg-indigo-50 font-bold">
                Cumul (depuis {fmtShort(startingBalance)}€)
              </td>
              {monthlyTotals.map((m, i) => (
                <td
                  key={i}
                  className={
                    "text-right tabular-nums px-2 py-1 font-bold " +
                    (m.cum >= 0 ? "text-indigo-700" : "text-red-700")
                  }
                >
                  {fmtShort(m.cum)}
                </td>
              ))}
              <td className="text-right tabular-nums px-3 bg-indigo-100 font-bold">
                {fmtShort(monthlyTotals[11]?.cum ?? startingBalance)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-[11px] text-midnight-500 flex items-start gap-1.5">
        <span>
          💡 Clic sur l'icône pour basculer{" "}
          <span className="inline-flex items-center gap-0.5 mx-0.5">⏰</span>{" "}
          Prévu ↔{" "}
          <span className="inline-flex items-center gap-0.5 mx-0.5">✓</span>{" "}
          Payé. Clic sur la cellule pour éditer le montant et accéder au
          statut « Sauté ».
        </span>
      </p>

      {/* MODALS */}
      {showSettings && (
        <SettingsModal
          initialBalance={startingBalance}
          initialDate={startingDate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showCleanup && (
        <CleanupModal
          year={data.year}
          onClose={() => setShowCleanup(false)}
        />
      )}

      {showNewRecurring && (
        <RecurringModal
          categories={categories}
          onClose={() => setShowNewRecurring(false)}
        />
      )}

      {editingRecId && (
        <RecurringModal
          categories={categories}
          existing={data.rows.find((r) => r.recurringId === editingRecId)}
          onClose={() => setEditingRecId(null)}
        />
      )}

      {showNewOneOff.open && (
        <OneOffModal
          categories={categories}
          kind={showNewOneOff.kind}
          year={data.year}
          onClose={() => setShowNewOneOff({ open: false, kind: "EXPENSE" })}
        />
      )}

      {editingOneOffId && (
        <OneOffModal
          categories={categories}
          existing={data.rows.find((r) => r.oneOffId === editingOneOffId)}
          year={data.year}
          onClose={() => setEditingOneOffId(null)}
        />
      )}

      {editingCell && (
        <CellEditorModal
          row={data.rows.find((r) => r.id === editingCell.rowId)!}
          monthIdx={editingCell.monthIdx}
          year={data.year}
          onClose={() => setEditingCell(null)}
        />
      )}
    </div>
  );
}

// ─────────── Section Block ───────────

import { colorForCategory, NO_CATEGORY } from "./category-color";

function SectionBlock({
  sectionKey,
  rows,
  isCollapsed,
  onToggle,
  editingCell,
  setEditingCell,
  setEditingRecId,
  setEditingOneOffId,
  year
}: {
  sectionKey: SectionKey;
  rows: CashflowRow[];
  isCollapsed: boolean;
  onToggle: () => void;
  editingCell: { rowId: string; monthIdx: number } | null;
  setEditingCell: (v: { rowId: string; monthIdx: number } | null) => void;
  setEditingRecId: (id: string | null) => void;
  setEditingOneOffId: (id: string | null) => void;
  year: number;
}) {
  // État des sous-catégories repliées (scope = cette section)
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  if (rows.length === 0 && (sectionKey === "commitment" || sectionKey === "simulation")) {
    return null;
  }

  // Regroupe par catégorie
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, CashflowRow[]>();
    for (const r of rows) {
      const cat = r.category?.trim() || NO_CATEGORY;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    // Tri : catégories alphabétiques, "(sans catégorie)" en dernier
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === NO_CATEGORY) return 1;
      if (b === NO_CATEGORY) return -1;
      return a.localeCompare(b);
    });
  }, [rows]);

  const sectionTotal = rows.reduce(
    (s, r) => s + r.cells.reduce((sm, c) => sm + (c.status === "SKIPPED" ? 0 : c.amount), 0),
    0
  );

  // Sous-totaux mensuels par catégorie (pour affichage dans la ligne header de catégorie)
  function computeCatCellTotals(catRows: CashflowRow[]): number[] {
    return Array.from({ length: 12 }, (_, i) =>
      catRows.reduce(
        (s, r) => s + (r.cells[i].status === "SKIPPED" ? 0 : r.cells[i].amount),
        0
      )
    );
  }

  // Doit-on afficher les sous-catégories ? Seulement s'il y en a > 1 (sinon c'est juste du bruit)
  const showCategories = groupedByCategory.length > 1;

  return (
    <>
      {/* Header de section */}
      <tr
        className={
          "border-t border-midnight-200 cursor-pointer " +
          (sectionKey === "simulation"
            ? "bg-purple-50/60"
            : sectionKey === "commitment"
            ? "bg-amber-50/60"
            : "bg-midnight-50/60")
        }
        onClick={onToggle}
      >
        <td className="px-3 py-1.5 font-semibold text-midnight-700 sticky left-0 bg-inherit z-10">
          <span className="inline-flex items-center gap-1">
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            {SECTION_LABELS[sectionKey]} ({rows.length})
          </span>
        </td>
        {[...Array(12)].map((_, i) => (
          <td key={i}></td>
        ))}
        <td className="text-right tabular-nums px-3 font-semibold text-midnight-700 bg-midnight-100/60">
          {fmtShort(sectionTotal)}
        </td>
        <td></td>
      </tr>

      {!isCollapsed && showCategories &&
        groupedByCategory.map(([catName, catRows]) => {
          const isCatCollapsed = collapsedCats[catName] ?? false;
          const catTotal = catRows.reduce(
            (s, r) =>
              s +
              r.cells.reduce((sm, c) => sm + (c.status === "SKIPPED" ? 0 : c.amount), 0),
            0
          );
          const catCellTotals = computeCatCellTotals(catRows);
          const isIncome = catRows.every((r) => r.isIncome);
          const isExpense = catRows.every((r) => !r.isIncome);
          const dotColor =
            catName === NO_CATEGORY
              ? "bg-midnight-300"
              : colorForCategory(catName);

          return (
            <Fragment key={`cat-${catName}`}>
              {/* Sous-header de catégorie */}
              <tr
                className="bg-white/60 border-t border-midnight-100 hover:bg-midnight-50/40 cursor-pointer"
                onClick={() =>
                  setCollapsedCats((c) => ({ ...c, [catName]: !c[catName] }))
                }
              >
                <td className="px-3 py-1 pl-6 sticky left-0 bg-inherit z-10">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    {isCatCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-midnight-400" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-midnight-400" />
                    )}
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="font-semibold text-midnight-700">
                      {catName}
                    </span>
                    <span className="text-midnight-400">({catRows.length})</span>
                  </span>
                </td>
                {catCellTotals.map((amount, i) => (
                  <td
                    key={i}
                    className={
                      "text-right px-2 py-0.5 text-[11px] tabular-nums font-medium " +
                      (amount === 0
                        ? "text-midnight-300"
                        : isIncome
                        ? "text-emerald-700/80"
                        : isExpense
                        ? "text-red-700/80"
                        : "text-midnight-600")
                    }
                  >
                    {amount === 0 ? "—" : fmtShort(amount)}
                  </td>
                ))}
                <td
                  className={
                    "text-right tabular-nums px-3 font-semibold text-xs bg-midnight-50/60 " +
                    (isIncome
                      ? "text-emerald-700"
                      : isExpense
                      ? "text-red-700"
                      : "text-midnight-700")
                  }
                >
                  {fmtShort(catTotal)}
                </td>
                <td></td>
              </tr>

              {/* Lignes de la catégorie */}
              {!isCatCollapsed &&
                catRows.map((row) => (
                  <RowLine
                    key={row.id}
                    row={row}
                    year={year}
                    indent
                    isEditingCell={(idx) =>
                      editingCell?.rowId === row.id && editingCell.monthIdx === idx
                    }
                    onEditCell={(idx) =>
                      setEditingCell({ rowId: row.id, monthIdx: idx })
                    }
                    onEditRow={() => {
                      if (row.recurringId) setEditingRecId(row.recurringId);
                      else if (row.oneOffId) setEditingOneOffId(row.oneOffId);
                    }}
                  />
                ))}
            </Fragment>
          );
        })}

      {/* Fallback : 1 seule catégorie ou aucune → on liste directement les lignes sans groupement */}
      {!isCollapsed && !showCategories &&
        rows.map((row) => (
          <RowLine
            key={row.id}
            row={row}
            year={year}
            isEditingCell={(idx) =>
              editingCell?.rowId === row.id && editingCell.monthIdx === idx
            }
            onEditCell={(idx) =>
              setEditingCell({ rowId: row.id, monthIdx: idx })
            }
            onEditRow={() => {
              if (row.recurringId) setEditingRecId(row.recurringId);
              else if (row.oneOffId) setEditingOneOffId(row.oneOffId);
            }}
          />
        ))}
    </>
  );
}

// ─────────── Single Row ───────────

function RowLine({
  row,
  year,
  isEditingCell,
  onEditCell,
  onEditRow,
  indent = false
}: {
  row: CashflowRow;
  year: number;
  isEditingCell: (idx: number) => boolean;
  onEditCell: (idx: number) => void;
  onEditRow: () => void;
  indent?: boolean;
}) {
  const [pending, start] = useTransition();
  const editable = row.kind !== "milestones";
  const isSimulation = row.kind === "simulation";
  const isCommitment = row.kind === "commitment";

  function cycleStatus(monthIdx: number) {
    if (!row.recurringId && !row.oneOffId) return;
    start(async () => {
      try {
        if (row.recurringId) {
          await cycleMonthlyStatus(row.recurringId, year, monthIdx + 1);
        } else if (row.oneOffId) {
          await toggleOneOffStatus(row.oneOffId);
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <tr
      className={
        "hover:bg-midnight-50/40 " +
        (isSimulation
          ? "[&_td]:!italic [&_td]:opacity-90"
          : isCommitment
          ? "border-l-2 border-amber-400"
          : "")
      }
    >
      <td
        className={
          "py-1 sticky left-0 bg-white z-10 hover:bg-midnight-50/40 " +
          (indent ? "pl-10 pr-3" : "px-3")
        }
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium text-midnight-900">
              {row.label}
            </div>
            {/* Affichage de la fréquence seulement (la catégorie est déjà dans le sous-header) */}
            {row.frequency && row.frequency !== "MONTHLY" && (
              <div className="text-[10px] text-midnight-400 truncate">
                {row.frequency.toLowerCase()}
              </div>
            )}
            {!indent && row.category && (
              <div className="text-[10px] text-midnight-400 truncate">
                {row.category}
              </div>
            )}
          </div>
          {editable && (
            <button
              onClick={onEditRow}
              className="text-midnight-400 hover:text-midnight-700 p-1"
              title="Éditer la ligne"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      </td>
      {row.cells.map((cell, i) => {
        const hasValue = cell.amount > 0;
        const isPaid = cell.status === "PAID";
        const isSkipped = cell.status === "SKIPPED";
        return (
          <td
            key={i}
            className={
              "text-right px-2 py-0.5 group relative " +
              (hasValue && !isSkipped
                ? row.isIncome
                  ? "text-emerald-700"
                  : "text-red-700"
                : "text-midnight-300") +
              (isPaid ? " bg-emerald-50/70" : "") +
              (isSkipped ? " line-through opacity-50" : "") +
              (editable ? " cursor-pointer hover:bg-midnight-100" : "")
            }
            onClick={() => editable && hasValue && onEditCell(i)}
          >
            <div className="flex items-center justify-end gap-1 tabular-nums">
              <span>{hasValue ? fmtShort(cell.amount) : "—"}</span>
              {hasValue && editable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleStatus(i);
                  }}
                  className="opacity-60 hover:opacity-100"
                  title={
                    isPaid
                      ? "Payé → Prévu (annuler le paiement)"
                      : isSkipped
                      ? "Sauté → Payé"
                      : "Prévu → Payé"
                  }
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isPaid ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : isSkipped ? (
                    <X className="w-3 h-3 text-midnight-400" />
                  ) : (
                    <span className="text-[10px]">⏰</span>
                  )}
                </button>
              )}
            </div>
          </td>
        );
      })}
      <td
        className={
          "text-right tabular-nums px-3 font-semibold " +
          (row.isIncome ? "text-emerald-700" : "text-red-700") +
          " bg-midnight-50"
        }
      >
        {fmtShort(row.totalYear)}
      </td>
      <td>
        {editable && row.oneOffId && (
          <DeleteOneOffButton id={row.oneOffId} label={row.label} />
        )}
        {editable && row.recurringId && (
          <DeleteRecurringButton id={row.recurringId} label={row.label} />
        )}
      </td>
    </tr>
  );
}

function DeleteOneOffButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm(`Supprimer « ${label} » ?`)) return;
        start(async () => {
          try {
            await deleteOneOffEntry(id);
            toast.success("Supprimé");
          } catch (e: any) {
            toast.error(e.message);
          }
        });
      }}
      disabled={pending}
      className="text-midnight-400 hover:text-red-600 p-1"
      title="Supprimer"
    >
      {pending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Trash2 className="w-3 h-3" />
      )}
    </button>
  );
}
function DeleteRecurringButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        if (
          !confirm(
            `Supprimer la ligne récurrente « ${label} » et toutes ses entrées mensuelles ?`
          )
        )
          return;
        start(async () => {
          try {
            await deleteRecurringExpense(id);
            toast.success("Supprimé");
          } catch (e: any) {
            toast.error(e.message);
          }
        });
      }}
      disabled={pending}
      className="text-midnight-400 hover:text-red-600 p-1"
      title="Supprimer"
    >
      {pending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Trash2 className="w-3 h-3" />
      )}
    </button>
  );
}

// ─────────── Modals ───────────

function Modal({
  children,
  onClose,
  title
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-midnight-500 hover:text-midnight-900">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function SettingsModal({
  initialBalance,
  initialDate,
  onClose
}: {
  initialBalance: number;
  initialDate: string;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <Modal title="Solde initial" onClose={onClose}>
      <form
        action={(fd) => {
          start(async () => {
            try {
              await upsertCashflowSettings(fd);
              toast.success("Solde initial mis à jour");
              onClose();
            } catch (e: any) {
              toast.error(e.message);
            }
          });
        }}
        className="space-y-3"
      >
        <div>
          <label className="label">Solde de banque au départ</label>
          <input
            name="startingBalance"
            type="number"
            step="0.01"
            defaultValue={initialBalance}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Date de référence</label>
          <input
            name="startingDate"
            type="date"
            defaultValue={initialDate}
            className="input"
            required
          />
          <p className="text-[11px] text-midnight-500 mt-1">
            C'est à partir de ce solde que le cumul mensuel est calculé.
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button disabled={pending} className="btn-primary">
            <Save className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RecurringModal({
  existing,
  categories,
  onClose
}: {
  existing?: CashflowRow;
  categories: string[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const isEdit = !!existing?.recurringId;
  const [freq, setFreq] = useState(existing?.frequency ?? "MONTHLY");
  return (
    <Modal title={isEdit ? "Modifier le récurrent" : "Nouveau récurrent"} onClose={onClose}>
      <form
        action={(fd) => {
          start(async () => {
            try {
              if (isEdit && existing?.recurringId) {
                await updateRecurringExpense(existing.recurringId, fd);
              } else {
                await createRecurringExpense(fd);
              }
              toast.success("Enregistré");
              onClose();
            } catch (e: any) {
              toast.error(e.message);
            }
          });
        }}
        className="space-y-3"
      >
        <div>
          <label className="label">Libellé *</label>
          <input
            name="label"
            defaultValue={existing?.label ?? ""}
            required
            className="input"
            placeholder="ex: Loyer bureau, Salaires, Abo SaaS…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Catégorie</label>
            <CategoryInput
              categories={categories}
              initial={existing?.category ?? ""}
              placeholder="ex: Charges fixes, Personnel…"
            />
          </div>
          <div>
            <label className="label">Montant par défaut (€) *</label>
            <input
              name="defaultAmount"
              type="number"
              step="0.01"
              defaultValue={existing?.defaultAmount ?? ""}
              className="input"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fréquence</label>
            <select
              name="frequency"
              defaultValue={existing?.frequency ?? "MONTHLY"}
              onChange={(e) => setFreq(e.target.value)}
              className="input"
            >
              <option value="MONTHLY">Tous les mois</option>
              <option value="QUARTERLY">Trimestriel (3,6,9,12)</option>
              <option value="SEMI_ANNUAL">Semestriel (6,12)</option>
              <option value="ANNUAL">Annuel (déc)</option>
              <option value="CUSTOM">Mois spécifiques</option>
            </select>
          </div>
          <div>
            <label className="label flex items-center gap-2">
              <input
                type="checkbox"
                name="isIncome"
                value="true"
                defaultChecked={existing?.isIncome ?? false}
              />
              C'est une recette (pas une dépense)
            </label>
          </div>
        </div>
        {freq === "CUSTOM" && (
          <div>
            <label className="label">Mois (1-12 séparés par virgule)</label>
            <input
              name="paymentMonths"
              defaultValue={(existing?.paymentMonths ?? []).join(",")}
              className="input"
              placeholder="ex: 1,4,7,10"
            />
          </div>
        )}
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button disabled={pending} className="btn-primary">
            <Save className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

function OneOffModal({
  existing,
  kind: kindProp,
  year,
  categories,
  onClose
}: {
  existing?: CashflowRow;
  kind?: "EXPENSE" | "INCOME" | "COMMITMENT" | "SIMULATION";
  year: number;
  categories: string[];
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const isEdit = !!existing?.oneOffId;
  const existingAmount = existing?.cells.find((c) => c.amount > 0)?.amount ?? 0;
  const existingMonthIdx = existing?.cells.findIndex((c) => c.amount > 0) ?? 0;
  const existingDate = new Date(year, existingMonthIdx, 15)
    .toISOString()
    .slice(0, 10);
  const kindLabel: Record<string, string> = {
    EXPENSE: "Dépense ponctuelle",
    INCOME: "Recette manuelle",
    COMMITMENT: "Engagement futur",
    SIMULATION: "Simulation what-if"
  };
  const initialKind =
    (existing?.kind === "oneoff_expense"
      ? "EXPENSE"
      : existing?.kind === "oneoff_income"
      ? "INCOME"
      : existing?.kind === "commitment"
      ? "COMMITMENT"
      : existing?.kind === "simulation"
      ? "SIMULATION"
      : kindProp) ?? "EXPENSE";
  return (
    <Modal
      title={isEdit ? "Modifier" : kindLabel[initialKind]}
      onClose={onClose}
    >
      <form
        action={(fd) => {
          start(async () => {
            try {
              if (isEdit && existing?.oneOffId) {
                await updateOneOffEntry(existing.oneOffId, fd);
              } else {
                await createOneOffEntry(fd);
              }
              toast.success("Enregistré");
              onClose();
            } catch (e: any) {
              toast.error(e.message);
            }
          });
        }}
        className="space-y-3"
      >
        <input type="hidden" name="kind" value={initialKind} />
        <div>
          <label className="label">Libellé *</label>
          <input
            name="label"
            defaultValue={existing?.label ?? ""}
            required
            className="input"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Catégorie</label>
            <CategoryInput
              categories={categories}
              initial={existing?.category ?? ""}
              placeholder="ex: Marketing, Hardware…"
            />
          </div>
          <div>
            <label className="label">Montant (€) *</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              defaultValue={existingAmount}
              className="input"
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date *</label>
            <input
              name="date"
              type="date"
              defaultValue={isEdit ? existingDate : `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15`}
              required
              className="input"
            />
            <p className="text-[10px] text-midnight-500 mt-1">
              Seul le mois compte pour le cashflow
            </p>
          </div>
          <div>
            <label className="label">Statut</label>
            <select name="status" defaultValue="PLANNED" className="input">
              <option value="PLANNED">Prévu</option>
              <option value="PAID">{initialKind === "INCOME" ? "Encaissé" : "Payé"}</option>
              <option value="SKIPPED">Annulé</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button disabled={pending} className="btn-primary">
            <Save className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CleanupModal({
  year,
  onClose
}: {
  year: number;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  // Mois actuel (1-12) ou janvier par défaut
  const now = new Date();
  const currentMonth =
    year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const [fromMonth, setFromMonth] = useState<number>(currentMonth);

  return (
    <Modal title="Démarrer l'encodage à partir de…" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-midnight-700">
          Cette action va :
        </p>
        <ul className="text-sm text-midnight-600 list-disc ml-5 space-y-1">
          <li>
            Marquer toutes les <strong>dépenses récurrentes</strong> avant
            le mois choisi comme <strong>« Sauté »</strong> (elles restent
            visibles, barrées, mais ne comptent plus dans les totaux/cumul)
          </li>
          <li>
            <strong>Supprimer définitivement</strong> toutes les{" "}
            <strong>dépenses/recettes ponctuelles</strong> antérieures
          </li>
          <li>
            Les <strong>BillingMilestones (factures)</strong> ne sont pas
            touchés — ils restent intacts car ils viennent d'ailleurs
          </li>
        </ul>
        <div>
          <label className="label">Démarrer à partir de :</label>
          <select
            value={fromMonth}
            onChange={(e) => setFromMonth(parseInt(e.target.value, 10))}
            className="input"
          >
            {MONTH_LABELS.map((m, i) => (
              <option key={i} value={i + 1}>
                {m} {year}
              </option>
            ))}
          </select>
          {fromMonth === 1 && (
            <p className="text-[11px] text-midnight-500 mt-1">
              Janvier sélectionné → rien à effacer.
            </p>
          )}
        </div>
        <div className="rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
          ⚠️ La suppression des one-offs est <strong>irréversible</strong>.
          Les récurrents passés en « Sauté » peuvent être annulés cellule
          par cellule via le modal d'édition.
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button
            disabled={pending || fromMonth === 1}
            onClick={() => {
              if (
                !confirm(
                  `Tu confirmes vouloir effacer/skipper tout avant ${MONTH_LABELS[fromMonth - 1]} ${year} ?`
                )
              )
                return;
              start(async () => {
                try {
                  const result = await cleanupCashflowBefore(year, fromMonth);
                  toast.success(
                    `${result.skippedCount} lignes skippées, ${result.deletedCount} one-offs supprimés`
                  );
                  onClose();
                } catch (e: any) {
                  toast.error(e?.message ?? "Erreur");
                }
              });
            }}
            className="btn-primary disabled:opacity-50"
          >
            <Eraser className="w-4 h-4" />
            {pending ? "Nettoyage…" : "Confirmer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CellEditorModal({
  row,
  monthIdx,
  year,
  onClose
}: {
  row: CashflowRow;
  monthIdx: number;
  year: number;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const cell = row.cells[monthIdx];
  const monthLabel = MONTH_LABELS[monthIdx];
  // Cellule d'un récurrent → upsertMonthlyEntry
  // Cellule d'un one-off → on édite directement le one-off (ce qui change le montant pour tout le mois)
  const isRecurring =
    row.kind === "recurring_expense" || row.kind === "recurring_income";
  return (
    <Modal
      title={`${row.label} — ${monthLabel} ${year}`}
      onClose={onClose}
    >
      {isRecurring && row.recurringId ? (
        <form
          action={(fd) => {
            start(async () => {
              try {
                await upsertMonthlyEntry(fd);
                toast.success("Cellule mise à jour");
                onClose();
              } catch (e: any) {
                toast.error(e.message);
              }
            });
          }}
          className="space-y-3"
        >
          <input
            type="hidden"
            name="recurringExpenseId"
            value={row.recurringId}
          />
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={monthIdx + 1} />
          <div>
            <label className="label">
              Montant override (€) — laisser vide pour utiliser le défaut (
              {row.defaultAmount}€)
            </label>
            <input
              name="amountOverride"
              type="number"
              step="0.01"
              defaultValue={
                cell.amount && cell.amount !== row.defaultAmount
                  ? cell.amount
                  : ""
              }
              className="input"
              placeholder={`Défaut : ${row.defaultAmount}€`}
            />
          </div>
          <div>
            <label className="label">Statut</label>
            <select
              name="status"
              defaultValue={cell.status}
              className="input"
            >
              <option value="PLANNED">⏰ Prévu</option>
              <option value="PAID">✓ Payé / Encaissé</option>
              <option value="SKIPPED">⊘ Sauté ce mois</option>
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={cell.notes ?? ""}
              className="input"
              placeholder="Ex: Montant réajusté, facture spécifique…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Annuler
            </button>
            <button disabled={pending} className="btn-primary">
              <Save className="w-4 h-4" /> Enregistrer
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-midnight-600">
          Cette cellule appartient à un type qui se gère depuis la ligne complète.
          Édite la ligne via le crayon dans la 1ère colonne.
        </p>
      )}
    </Modal>
  );
}

function fmtShort(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return Math.round(n).toLocaleString("fr-BE");
  }
  return n.toLocaleString("fr-BE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}
