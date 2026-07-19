"use client";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
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
  Eraser,
  CalendarRange,
  Repeat
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
  cleanupCashflowBefore,
  generateMonthlyMissionInvoices,
  updateBillingMilestone,
  deleteBillingMilestoneFromCashflow,
  addBillingMilestoneToMission,
  getMilestonesByIds,
  getMissionMilestonesYear,
  updateMissionDaysBulk,
  updateMissionFromCashflow,
  createRecurringOneOffEntries,
  getOneOffById,
  updateOneOffCell,
  updateMissionMilestoneDays
} from "@/server/actions/cashflow";
import { setMilestoneStatus } from "@/server/actions/offers";
import { setPayrollMonthStatus, setPayrollMonthAmount } from "@/server/actions/payroll-employees";
import { renameCashflowCategory } from "@/server/actions/cashflow";

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

export type MissionForBilling = {
  id: string;
  reference: string;
  title: string;
  dailyRate: number;
  companyName: string | null;
  consultantName: string | null;
};

export function CashflowGrid({
  data,
  startingBalance,
  startingDate,
  categories,
  missions
}: {
  data: CashflowYear;
  startingBalance: number;
  startingDate: string;
  categories: string[];
  missions: MissionForBilling[];
}) {
  const [includeSim, setIncludeSim] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    monthIdx: number;
  } | null>(null);
  const [editingMilestoneCell, setEditingMilestoneCell] = useState<{
    rowLabel: string;
    monthIdx: number;
    milestoneIds: string[];
    missionId?: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  const [showNewRecurring, setShowNewRecurring] = useState(false);
  const [showMissionGen, setShowMissionGen] = useState(false);
  const [showNewOneOff, setShowNewOneOff] = useState<{
    open: boolean;
    kind: "EXPENSE" | "INCOME" | "COMMITMENT" | "SIMULATION";
  }>({ open: false, kind: "EXPENSE" });
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [editingOneOffId, setEditingOneOffId] = useState<string | null>(null);
  // ID d'un OneOff précis à éditer en mode "cellule" (montant + statut)
  const [editingOneOffCellId, setEditingOneOffCellId] = useState<string | null>(null);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
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
      // Les lignes hidden (projets clôturés = toutes tranches payées) sont
      // toujours contributrices aux monthlyTotals/yearTotals côté serveur,
      // mais on ne les affiche PAS dans la grille — sinon on pollue la vue
      // avec des lignes inertes qui n'attendent plus aucune action.
      if (r.hidden) continue;
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
          {missions.length > 0 && (
            <button
              onClick={() => setShowMissionGen(true)}
              className="btn-secondary text-sm"
              title="Générer N factures mensuelles pour une mission entre 2 dates"
            >
              <Repeat className="w-4 h-4" /> Facturation mission récurrente
            </button>
          )}
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
                  setEditingMilestoneCell={setEditingMilestoneCell}
                  setEditingRecId={setEditingRecId}
                  setEditingOneOffId={setEditingOneOffId}
                  setEditingMissionId={setEditingMissionId}
                  setEditingOneOffCellId={setEditingOneOffCellId}
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

      {/* Légende code couleur des cellules — aligné sur le code dans la table */}
      <div className="text-[11px] text-midnight-500 flex flex-wrap items-center gap-3 mt-1">
        <span className="font-medium text-midnight-600">Code couleur :</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-blue-50 border border-blue-200"></span>
          Prévue / encodée
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-amber-50 border border-amber-200"></span>
          Facturée (en attente paiement)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded bg-emerald-50 border border-emerald-200"></span>
          Payée / encaissée
        </span>
        <span className="inline-flex items-center gap-1.5 opacity-60">
          <span className="inline-block w-3 h-3 rounded border border-midnight-200 line-through"></span>
          Sautée / annulée
        </span>
      </div>

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

      {showMissionGen && (
        <MissionGenModal
          missions={missions}
          year={data.year}
          onClose={() => setShowMissionGen(false)}
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
          missions={missions}
          kind={showNewOneOff.kind}
          year={data.year}
          onClose={() => setShowNewOneOff({ open: false, kind: "EXPENSE" })}
        />
      )}

      {editingOneOffId && (
        <OneOffModal
          categories={categories}
          missions={missions}
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

      {editingMilestoneCell && (
        <MilestoneCellModal
          rowLabel={editingMilestoneCell.rowLabel}
          monthIdx={editingMilestoneCell.monthIdx}
          year={data.year}
          milestoneIds={editingMilestoneCell.milestoneIds}
          missionId={editingMilestoneCell.missionId}
          onClose={() => setEditingMilestoneCell(null)}
        />
      )}

      {editingMissionId && (
        <MissionYearEditModal
          missionId={editingMissionId}
          year={data.year}
          onClose={() => setEditingMissionId(null)}
        />
      )}

      {editingOneOffCellId && (
        <OneOffCellEditModal
          oneOffId={editingOneOffCellId}
          onClose={() => setEditingOneOffCellId(null)}
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
  setEditingMilestoneCell,
  setEditingRecId,
  setEditingOneOffId,
  setEditingMissionId,
  setEditingOneOffCellId,
  year
}: {
  sectionKey: SectionKey;
  rows: CashflowRow[];
  isCollapsed: boolean;
  onToggle: () => void;
  editingCell: { rowId: string; monthIdx: number } | null;
  setEditingCell: (v: { rowId: string; monthIdx: number } | null) => void;
  setEditingMilestoneCell: (v: {
    rowLabel: string;
    monthIdx: number;
    milestoneIds: string[];
    missionId?: string;
  } | null) => void;
  setEditingRecId: (id: string | null) => void;
  setEditingOneOffId: (id: string | null) => void;
  setEditingMissionId: (id: string | null) => void;
  setEditingOneOffCellId: (id: string | null) => void;
  year: number;
}) {
  // État des sous-catégories repliées (scope = cette section).
  // Par défaut, toutes les catégories sont REPLIÉES (on ne voit que les en-têtes
  // avec les sous-totaux, pas le détail des lignes). L'utilisateur déplie ce
  // qu'il veut consulter.
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

  // Doit-on afficher les sous-catégories ? Pour les Revenus, on les affiche dès
  // qu'on a au moins une ligne MISSION ou PROJET (cohérence d'affichage entre
  // 2026 et 2027 : sinon une année qui n'a que des missions perdait le header
  // "MISSION"). Pour les autres sections, on garde l'ancien comportement (>1
  // catégorie distincte).
  const hasMilestoneCat = rows.some((r) => r.kind === "milestones");
  const showCategories =
    (sectionKey === "income" && hasMilestoneCat) ||
    groupedByCategory.length > 1;

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
          // Par défaut : catégorie repliée. L'utilisateur déplie ce qu'il
          // veut voir en détail.
          const isCatCollapsed = collapsedCats[catName] ?? true;
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
                    {catName !== NO_CATEGORY && (
                      <button
                        onClick={(e) => {
                          // Ne pas déclencher le toggle collapsed en cliquant
                          // sur le crayon. On demande le nouveau nom via prompt
                          // (léger, pas besoin d'un modal complet pour ça).
                          e.stopPropagation();
                          const newName = window.prompt(
                            `Renommer la catégorie « ${catName} » :`,
                            catName
                          );
                          if (newName == null) return;
                          const trimmed = newName.trim();
                          if (trimmed === catName) return;
                          renameCashflowCategory(catName, trimmed)
                            .then((r) =>
                              toast.success(
                                `Renommée : ${r.recurringUpdated + r.oneOffUpdated} ligne(s) mise(s) à jour`
                              )
                            )
                            .catch((err) =>
                              toast.error(err?.message ?? "Erreur")
                            );
                        }}
                        className="ml-1 text-midnight-400 hover:text-indigoaccent"
                        title="Renommer cette catégorie (bulk update)"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
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
                    onEditCell={(idx) => {
                      const cell = row.cells[idx];
                      // Cellule de mission agrégée → modal milestone
                      if (row.kind === "milestones" && row.missionId) {
                        setEditingMilestoneCell({
                          rowLabel: row.label,
                          monthIdx: idx,
                          milestoneIds: cell.milestoneIds ?? [],
                          missionId: row.missionId
                        });
                      } else if (
                        row.kind === "milestones" &&
                        cell.milestoneIds &&
                        cell.milestoneIds.length > 0
                      ) {
                        setEditingMilestoneCell({
                          rowLabel: row.label,
                          monthIdx: idx,
                          milestoneIds: cell.milestoneIds,
                          missionId: row.missionId
                        });
                      } else if (
                        cell.monthEntryId &&
                        (row.kind === "oneoff_income" ||
                          row.kind === "oneoff_expense" ||
                          row.kind === "commitment" ||
                          row.kind === "simulation")
                      ) {
                        // OneOff (incl. sim/engagement/oneoff récurrent groupé) :
                        // monthEntryId = OneOffCashflowEntry.id → modal OneOff
                        setEditingOneOffCellId(cell.monthEntryId);
                      } else {
                        // Récurrence (recurring_income/expense) : monthEntryId
                        // référence un RecurringExpenseMonth (pas un OneOff).
                        // → on passe par l'éditeur inline rowId+monthIdx.
                        setEditingCell({ rowId: row.id, monthIdx: idx });
                      }
                    }}
                    onEditRow={() => {
                      if (row.recurringId) setEditingRecId(row.recurringId);
                      else if (row.oneOffId) setEditingOneOffId(row.oneOffId);
                      else if (row.missionId) setEditingMissionId(row.missionId);
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
  // Une ligne est éditable si elle est manipulable directement (récurrent, one-off…)
  // Pour les milestones agrégés par mission, la cellule l'est uniquement si elle
  // a des milestoneIds (donc une vraie ligne de mission, pas standalone).
  const editable =
    row.kind !== "milestones" ||
    row.cells.some((c) => c.milestoneIds && c.milestoneIds.length > 0);
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
        const isInvoiced = cell.status === "INVOICED";
        const isSkipped = cell.status === "SKIPPED";
        // Code couleur statut (visible uniquement si la cellule a une valeur) :
        //   vert    → encaissée                (PAID)
        //   orange  → facture émise, en attente (INVOICED, INVOICED+TRANSMITTED)
        //   bleu    → juste encodée / prévue   (PLANNED, READY)
        //   (rien)  → 0 ou cellule vide
        const statusBg = hasValue && !isSkipped
          ? isPaid
            ? " bg-emerald-50/70"
            : isInvoiced
              ? " bg-amber-50/70"
              : " bg-blue-50/60"
          : "";
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
              statusBg +
              (isSkipped ? " line-through opacity-50" : "") +
              (editable ? " cursor-pointer hover:bg-midnight-100" : "")
            }
            title={
              row.kind === "milestones" && cell.daysCount && cell.daysCount > 0
                ? `${cell.daysCount}j prestés ce mois`
                : undefined
            }
            onClick={() =>
              editable &&
              (hasValue || row.kind === "milestones") &&
              onEditCell(i)
            }
          >
            {/* Popup hover : nb de jours sur les cellules mission */}
            {row.kind === "milestones" && cell.daysCount && cell.daysCount > 0 && (
              <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 z-30 hidden group-hover:block whitespace-nowrap rounded bg-midnight-900 text-white text-[10px] font-semibold px-2 py-1 shadow-lg">
                {cell.daysCount}j prestés
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-midnight-900" />
              </div>
            )}
            <div className="flex items-center justify-end gap-1 tabular-nums">
              <span>{hasValue ? fmtShort(cell.amount) : "—"}</span>
              {/* Toggle inline status pour recurring / oneoff */}
              {hasValue && editable && row.kind !== "milestones" && (
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
              {/* Toggle inline status pour milestones : marque TOUS les milestones
                  de la cellule comme PAID ou les remet en READY (n'apparaît que
                  s'il y a au moins un milestone). */}
              {hasValue &&
                editable &&
                row.kind === "milestones" &&
                cell.milestoneIds &&
                cell.milestoneIds.length > 0 && (
                  <MilestoneCellPayToggle
                    milestoneIds={cell.milestoneIds}
                    currentlyAllPaid={isPaid}
                  />
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
          <DeleteOneOffButton
            id={row.oneOffId}
            label={row.label}
            isGroup={row.id.startsWith("one-group-")}
          />
        )}
        {editable && row.recurringId && (
          <DeleteRecurringButton id={row.recurringId} label={row.label} />
        )}
      </td>
    </tr>
  );
}

/**
 * Toggle inline pour marquer payée(s) une ou plusieurs tranche(s) milestone(s)
 * en cliquant sur la cellule. Si la cellule a plusieurs milestones (cas mission
 * agrégée avec plusieurs tranches sur le même mois), on toggle TOUTES les
 * tranches d'un coup.
 */
function MilestoneCellPayToggle({
  milestoneIds,
  currentlyAllPaid
}: {
  milestoneIds: string[];
  currentlyAllPaid: boolean;
}) {
  const [pending, start] = useTransition();
  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    // Dé-payer → retour à INVOICED (la facture existe toujours), pas READY.
    // Sinon la ligne sortait du KPI "En cours" qui ne compte que INVOICED.
    const newStatus = currentlyAllPaid ? "INVOICED" : "PAID";
    start(async () => {
      try {
        await Promise.all(
          milestoneIds.map((id) =>
            setMilestoneStatus(id, newStatus as any)
          )
        );
        toast.success(
          currentlyAllPaid
            ? "Tranche(s) ré-ouverte(s) (retour à facturé)"
            : `${milestoneIds.length > 1 ? "Tranches" : "Tranche"} marquée(s) payée(s)`
        );
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      }
    });
  }
  return (
    <button
      onClick={toggle}
      disabled={pending}
      className="opacity-60 hover:opacity-100"
      title={
        currentlyAllPaid
          ? "Payé → Ré-ouvrir (annuler le paiement)"
          : "Marquer payé"
      }
    >
      {pending ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : currentlyAllPaid ? (
        <Check className="w-3 h-3 text-emerald-600" />
      ) : (
        <span className="text-[10px]">⏰</span>
      )}
    </button>
  );
}

function DeleteOneOffButton({
  id,
  label,
  isGroup
}: {
  id: string;
  label: string;
  isGroup?: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => {
        const msg = isGroup
          ? `Supprimer toute la récurrence « ${label} » (toutes les occurrences mensuelles) ?`
          : `Supprimer « ${label} » ?`;
        if (!confirm(msg)) return;
        start(async () => {
          try {
            const res = await deleteOneOffEntry(id);
            toast.success(
              res?.wasGroup
                ? `Récurrence supprimée (${res.deletedCount} mois)`
                : "Supprimé"
            );
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">À partir du</label>
            <input
              name="startDate"
              type="date"
              defaultValue={existing?.startDate ?? ""}
              className="input"
            />
            <div className="text-[10px] text-midnight-500 mt-0.5">
              Laisse vide = pas de date de début
            </div>
          </div>
          <div>
            <label className="label">Jusqu'au</label>
            <input
              name="endDate"
              type="date"
              defaultValue={existing?.endDate ?? ""}
              className="input"
            />
            <div className="text-[10px] text-midnight-500 mt-0.5">
              Laisse vide = pas de date de fin
            </div>
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

function OneOffModal({
  existing,
  kind: kindProp,
  year,
  categories,
  missions,
  onClose
}: {
  existing?: CashflowRow;
  kind?: "EXPENSE" | "INCOME" | "COMMITMENT" | "SIMULATION" | "SIMULATION_INCOME";
  year: number;
  categories: string[];
  missions: MissionForBilling[];
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
    SIMULATION: "Simulation dépense",
    SIMULATION_INCOME: "Simulation recette"
  };
  // En édition, on reconstruit le kind depuis la row + l'info `isIncome` :
  // une row de kind "simulation" peut être SIMULATION (dépense) ou
  // SIMULATION_INCOME (recette).
  const initialKind =
    (existing?.kind === "oneoff_expense"
      ? "EXPENSE"
      : existing?.kind === "oneoff_income"
      ? "INCOME"
      : existing?.kind === "commitment"
      ? "COMMITMENT"
      : existing?.kind === "simulation"
      ? existing.isIncome
        ? "SIMULATION_INCOME"
        : "SIMULATION"
      : kindProp) ?? "EXPENSE";

  // Toggle interne pour basculer simulation dépense ⇄ recette dans le modal
  // (uniquement quand on est en mode SIMULATION).
  const [simIsIncome, setSimIsIncome] = useState<boolean>(
    initialKind === "SIMULATION_INCOME"
  );
  const isSimulation =
    initialKind === "SIMULATION" || initialKind === "SIMULATION_INCOME";
  // Le kind effectif envoyé au serveur (mis à jour si l'utilisateur switch)
  const effectiveKind = isSimulation
    ? simIsIncome
      ? "SIMULATION_INCOME"
      : "SIMULATION"
    : initialKind;
  const isIncomeMode =
    effectiveKind === "INCOME" || effectiveKind === "SIMULATION_INCOME";

  // Mode facturation T&M : INCOME ou SIMULATION_INCOME (consultant en mission
  // potentielle pas encore signée)
  const canUseTmBilling = isIncomeMode && missions.length > 0;
  const [useTmBilling, setUseTmBilling] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [tmDays, setTmDays] = useState<number>(0);
  const [tmRate, setTmRate] = useState<number>(0);
  const [manualAmount, setManualAmount] = useState<number>(existingAmount);
  const [manualLabel, setManualLabel] = useState<string>(existing?.label ?? "");

  // TVA : applicable aux recettes (INCOME / SIMULATION_INCOME) et engagements
  // (COMMITMENT, considéré comme une facture future). Pour les dépenses on
  // garde TVAC direct.
  const supportsVat =
    isIncomeMode || effectiveKind === "COMMITMENT";
  const [vatRate, setVatRate] = useState<number>(21); // Belgique standard
  const [amountIsHtva, setAmountIsHtva] = useState<boolean>(supportsVat);

  // Récurrence mensuelle (uniquement en création, pas en édition)
  const supportsRecurrence = !isEdit;
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(
    `${year}-12-31`
  );

  // Construit un libellé "Facturation MIS-2026-0001 (Client X) — 5j × 800€"
  function buildTmLabel(m: MissionForBilling, days: number, rate: number) {
    const client = m.companyName ? ` (${m.companyName})` : "";
    return days > 0
      ? `Facturation ${m.reference}${client} — ${days}j × ${rate}€`
      : `Facturation ${m.reference}${client}`;
  }

  // Quand on sélectionne une mission, on auto-remplit le taux et le libellé
  function onMissionChange(missionId: string) {
    setSelectedMissionId(missionId);
    const m = missions.find((mm) => mm.id === missionId);
    if (m) {
      setTmRate(m.dailyRate);
      setManualLabel(buildTmLabel(m, tmDays, m.dailyRate));
    }
  }

  // Recalcule le libellé suggéré quand les jours changent
  function onDaysChange(d: number) {
    setTmDays(d);
    const m = missions.find((mm) => mm.id === selectedMissionId);
    if (m && d > 0) {
      setManualLabel(buildTmLabel(m, d, tmRate || m.dailyRate));
    }
  }

  // Montant HTVA (avant TVA) : depuis le calcul T&M ou la saisie manuelle
  const baseHtva = useTmBilling
    ? Math.round(tmDays * tmRate * 100) / 100
    : manualAmount;

  // TVA appliquée + TVAC final
  const vatAmount =
    supportsVat && amountIsHtva
      ? Math.round(baseHtva * (vatRate / 100) * 100) / 100
      : 0;
  // Le "amount" stocké = TVAC (ce qui arrive sur le compte) si HTVA, sinon le brut tel quel
  const computedAmount = supportsVat && amountIsHtva ? baseHtva + vatAmount : baseHtva;

  const finalLabel = manualLabel;

  return (
    <Modal
      title={isEdit ? "Modifier" : kindLabel[effectiveKind]}
      onClose={onClose}
    >
      <form
        action={(fd) => {
          // On force le montant final (TVAC si HTVA était saisi) et on
          // ajoute les décompositions dans les notes pour traçabilité.
          const noteLines: string[] = [];

          if (useTmBilling) {
            const mission = missions.find((mm) => mm.id === selectedMissionId);
            noteLines.push(
              `Facturation T&M : ${tmDays}j × ${tmRate}€/j${mission ? ` — Mission ${mission.reference}` : ""}`
            );
            fd.set("label", finalLabel);
          }

          if (supportsVat && amountIsHtva) {
            noteLines.push(
              `HTVA ${baseHtva.toFixed(2)}€ + TVA ${vatRate}% (${vatAmount.toFixed(2)}€) = TVAC ${computedAmount.toFixed(2)}€`
            );
          }

          // Stocke toujours le montant final (TVAC si applicable)
          fd.set("amount", String(computedAmount));

          if (noteLines.length > 0) {
            const existingNotes = (fd.get("notes") as string) || "";
            const breakdown = noteLines.join("\n");
            fd.set(
              "notes",
              existingNotes ? `${breakdown}\n${existingNotes}` : breakdown
            );
          }

          // Si récurrence activée, on appelle le bulk creator
          if (supportsRecurrence && isRecurring) {
            const startDate = String(fd.get("date") ?? "");
            fd.set("startDate", startDate);
            fd.set("endDate", recurrenceEndDate);
            // date n'est plus utilisé par l'action récurrente
            fd.delete("date");
            start(async () => {
              try {
                const r = await createRecurringOneOffEntries(fd);
                toast.success(`${r.created} entrées récurrentes créées`);
                onClose();
              } catch (e: any) {
                toast.error(e.message);
              }
            });
            return;
          }

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
        <input type="hidden" name="kind" value={effectiveKind} />

        {/* Toggle simulation dépense ⇄ recette */}
        {isSimulation && (
          <div className="flex items-center gap-1 p-1 rounded border border-amber-200 bg-amber-50/50">
            <button
              type="button"
              onClick={() => setSimIsIncome(false)}
              className={
                "flex-1 px-3 py-1.5 rounded text-sm font-medium transition " +
                (!simIsIncome
                  ? "bg-red-100 text-red-800 shadow-sm"
                  : "text-midnight-500 hover:bg-white")
              }
            >
              Dépense simulée
            </button>
            <button
              type="button"
              onClick={() => setSimIsIncome(true)}
              className={
                "flex-1 px-3 py-1.5 rounded text-sm font-medium transition " +
                (simIsIncome
                  ? "bg-emerald-100 text-emerald-800 shadow-sm"
                  : "text-midnight-500 hover:bg-white")
              }
            >
              Recette simulée
            </button>
          </div>
        )}

        {/* Toggle facturation T&M (seulement pour INCOME) */}
        {canUseTmBilling && (
          <label className="flex items-center gap-2 p-2 rounded border border-indigo-200 bg-indigo-50/50 cursor-pointer">
            <input
              type="checkbox"
              checked={useTmBilling}
              onChange={(e) => setUseTmBilling(e.target.checked)}
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-indigo-900">
                Calculer depuis une mission (jours × taux)
              </div>
              <div className="text-[10px] text-indigo-700">
                Facturation T&M : sélectionne la mission, tape les jours
                prestés, le montant se calcule auto.
              </div>
            </div>
          </label>
        )}

        {/* Mode T&M : sélecteur mission + jours */}
        {useTmBilling && (
          <div className="space-y-3 p-3 rounded border border-indigo-200 bg-white">
            <div>
              <label className="label">Mission *</label>
              <select
                value={selectedMissionId}
                onChange={(e) => onMissionChange(e.target.value)}
                className="input"
                required
              >
                <option value="">— Sélectionner —</option>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.reference} — {m.title}
                    {m.companyName ? ` · ${m.companyName}` : ""}
                    {m.consultantName ? ` · ${m.consultantName}` : ""}
                    {` · ${m.dailyRate}€/j`}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Jours prestés *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={tmDays || ""}
                  onChange={(e) => onDaysChange(Number(e.target.value) || 0)}
                  className="input text-right tabular-nums"
                  required={useTmBilling}
                />
              </div>
              <div>
                <label className="label">Taux journalier (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tmRate || ""}
                  onChange={(e) => setTmRate(Number(e.target.value) || 0)}
                  className="input text-right tabular-nums"
                  required={useTmBilling}
                />
                <div className="text-[10px] text-midnight-400 mt-0.5">
                  Pré-rempli depuis la mission, modifiable
                </div>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-sm flex items-center justify-between">
              <span className="text-emerald-800">
                <strong>{tmDays}j</strong> × <strong>{tmRate}€</strong> =
              </span>
              <span className="text-lg font-bold tabular-nums text-emerald-700">
                {fmtShort(computedAmount)} €
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="label">Libellé *</label>
          <input
            name="label"
            value={finalLabel}
            onChange={(e) => setManualLabel(e.target.value)}
            required
            className="input"
            placeholder={useTmBilling ? "Auto-généré depuis la mission" : ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Catégorie</label>
            <CategoryInput
              categories={categories}
              initial={existing?.category ?? (useTmBilling ? "Factures clients" : "")}
              placeholder="ex: Marketing, Hardware…"
            />
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span>
                Montant {supportsVat && amountIsHtva ? "HTVA" : ""} (€) *
              </span>
              {supportsVat && (
                <span className="text-[10px] font-normal text-midnight-500">
                  <label className="cursor-pointer">
                    <input
                      type="checkbox"
                      checked={amountIsHtva}
                      onChange={(e) => setAmountIsHtva(e.target.checked)}
                      className="mr-1"
                    />
                    HTVA
                  </label>
                </span>
              )}
            </label>
            <input
              name="amount"
              type="number"
              step="0.01"
              value={useTmBilling ? baseHtva : manualAmount || ""}
              onChange={(e) => setManualAmount(Number(e.target.value) || 0)}
              className="input"
              required
              disabled={useTmBilling}
            />
            {useTmBilling && (
              <div className="text-[10px] text-midnight-400 mt-0.5">
                Calculé auto : {tmDays}j × {tmRate}€
              </div>
            )}
          </div>
        </div>

        {/* Récurrence mensuelle (création uniquement) */}
        {supportsRecurrence && (
          <div className="p-3 rounded border border-purple-200 bg-purple-50/50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-purple-900">
                  Récurrence mensuelle
                </div>
                <div className="text-[10px] text-purple-700">
                  Génère une entrée par mois entre la date ci-dessous et la date
                  de fin, avec le même montant. Chaque entrée peut être ajustée
                  individuellement après.
                </div>
              </div>
            </label>
            {isRecurring && (
              <div className="pt-2 border-t border-purple-200">
                <label className="text-xs font-medium text-purple-900 block mb-1">
                  Jusqu'au (inclus)
                </label>
                <input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  className="input w-full"
                  required={isRecurring}
                />
                <div className="text-[10px] text-purple-700 mt-1">
                  Le libellé est suffixé avec le mois pour chaque entrée
                  (ex : <em>« Mon libellé — Juin 2026 »</em>)
                </div>
              </div>
            )}
          </div>
        )}

        {/* TVA — uniquement pour les recettes et engagements futurs */}
        {supportsVat && amountIsHtva && (
          <div className="p-3 rounded border border-emerald-200 bg-emerald-50/50 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-medium text-emerald-900">
                Taux de TVA
              </label>
              <div className="flex gap-1">
                {[0, 6, 12, 21].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setVatRate(r)}
                    className={
                      "text-xs px-2 py-0.5 rounded border " +
                      (vatRate === r
                        ? "bg-emerald-600 text-white border-emerald-600 font-semibold"
                        : "bg-white border-midnight-200 hover:bg-emerald-50")
                    }
                  >
                    {r}%
                  </button>
                ))}
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={vatRate}
                  onChange={(e) => setVatRate(Number(e.target.value) || 0)}
                  className="input w-16 text-right tabular-nums text-xs py-0.5 px-1"
                />
                <span className="text-xs text-midnight-500 self-center">%</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-emerald-200">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-midnight-500">
                  HTVA
                </div>
                <div className="font-semibold tabular-nums">
                  {fmtShort(baseHtva)} €
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-midnight-500">
                  TVA {vatRate}%
                </div>
                <div className="font-semibold tabular-nums text-amber-700">
                  +{fmtShort(vatAmount)} €
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-emerald-700">
                  TVAC (encaissé)
                </div>
                <div className="font-bold tabular-nums text-emerald-700">
                  {fmtShort(computedAmount)} €
                </div>
              </div>
            </div>
            <p className="text-[10px] text-midnight-500">
              💡 Le cashflow stocke le <strong>TVAC</strong> (ce qui arrive
              sur ton compte). La décomposition HTVA + TVA est ajoutée aux
              notes pour ta déclaration TVA.
            </p>
          </div>
        )}
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

function MissionGenModal({
  missions,
  year,
  onClose
}: {
  missions: MissionForBilling[];
  year: number;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [missionId, setMissionId] = useState<string>(missions[0]?.id ?? "");
  const [defaultDays, setDefaultDays] = useState<number>(20);
  // Plage par défaut : mois courant → fin d'année
  const now = new Date();
  const currentMonth = year === now.getFullYear() ? now.getMonth() + 1 : 1;
  const [fromYear, setFromYear] = useState<number>(year);
  const [fromMonth, setFromMonth] = useState<number>(currentMonth);
  const [toYear, setToYear] = useState<number>(year);
  const [toMonth, setToMonth] = useState<number>(12);
  const [billingDay, setBillingDay] = useState<number>(0); // 0 = dernier jour du mois

  const selected = missions.find((m) => m.id === missionId);
  const monthsCount = countMonths(fromYear, fromMonth, toYear, toMonth);
  const totalAmount = selected
    ? Math.round(monthsCount * defaultDays * selected.dailyRate * 100) / 100
    : 0;

  return (
    <Modal title="Facturation mission récurrente" onClose={onClose}>
      <form
        action={() =>
          start(async () => {
            try {
              if (!missionId) {
                toast.error("Sélectionne une mission");
                return;
              }
              const r = await generateMonthlyMissionInvoices({
                missionId,
                defaultDays,
                fromYear,
                fromMonth,
                toYear,
                toMonth,
                billingDay: billingDay > 0 ? billingDay : undefined
              });
              toast.success(
                `${r.created} tranche(s) créée(s)${r.skipped > 0 ? `, ${r.skipped} ignorée(s) (déjà existante)` : ""}`
              );
              onClose();
            } catch (e: any) {
              toast.error(e?.message ?? "Erreur");
            }
          })
        }
        className="space-y-3"
      >
        <p className="text-sm text-midnight-700">
          Génère une tranche de facturation par mois pour une mission T&M,
          basée sur <strong>jours estimés × taux journalier</strong>. Tu pourras
          ensuite ajuster individuellement chaque tranche (ex : moins de jours
          en juillet/août à cause des congés).
        </p>

        <div>
          <label className="label">Mission *</label>
          <select
            value={missionId}
            onChange={(e) => setMissionId(e.target.value)}
            className="input"
            required
          >
            <option value="">— Sélectionner —</option>
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.reference} — {m.title}
                {m.companyName ? ` · ${m.companyName}` : ""}
                {` · ${m.dailyRate}€/j`}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Jours estimés / mois *</label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={defaultDays}
              onChange={(e) =>
                setDefaultDays(Number(e.target.value) || 0)
              }
              className="input text-right tabular-nums"
              required
            />
            <p className="text-[10px] text-midnight-500 mt-1">
              Utilisé pour tous les mois — éditable individuellement après.
            </p>
          </div>
          <div>
            <label className="label">Jour de facturation</label>
            <select
              value={billingDay}
              onChange={(e) => setBillingDay(parseInt(e.target.value, 10))}
              className="input"
            >
              <option value="0">Dernier jour du mois</option>
              {[1, 5, 10, 15, 20, 25, 28].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Du mois</label>
            <div className="flex gap-1">
              <select
                value={fromMonth}
                onChange={(e) => setFromMonth(parseInt(e.target.value, 10))}
                className="input flex-1"
              >
                {MONTH_LABELS.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={fromYear}
                onChange={(e) => setFromYear(parseInt(e.target.value, 10))}
                className="input w-20"
                min={2020}
                max={2099}
              />
            </div>
          </div>
          <div>
            <label className="label">Au mois (inclus)</label>
            <div className="flex gap-1">
              <select
                value={toMonth}
                onChange={(e) => setToMonth(parseInt(e.target.value, 10))}
                className="input flex-1"
              >
                {MONTH_LABELS.map((m, i) => (
                  <option key={i} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={toYear}
                onChange={(e) => setToYear(parseInt(e.target.value, 10))}
                className="input w-20"
                min={2020}
                max={2099}
              />
            </div>
          </div>
        </div>

        {/* Récap calcul */}
        {selected && monthsCount > 0 && (
          <div className="rounded border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-emerald-900">Aperçu</span>
              <CalendarRange className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="text-xs text-midnight-700">
              <strong>{monthsCount}</strong> tranche{monthsCount > 1 ? "s" : ""}{" "}
              de <strong>{defaultDays}j × {selected.dailyRate}€</strong> ={" "}
              <strong className="text-emerald-700">
                {fmtShort(defaultDays * selected.dailyRate)} €
              </strong>{" "}
              par mois
            </div>
            <div className="text-base font-semibold tabular-nums text-emerald-700 mt-1">
              Total prévisionnel : {fmtShort(totalAmount)} €
            </div>
          </div>
        )}

        <div className="rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
          ⚠️ Les tranches existantes pour le même mois et la même mission
          seront <strong>ignorées</strong> (pas de doublons). Pour modifier
          un mois précis (ex : congés en août), édite la tranche après
          génération depuis la grille cashflow.
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button
            disabled={pending || !missionId || monthsCount === 0}
            className="btn-primary disabled:opacity-50"
          >
            <Repeat className="w-4 h-4" />
            {pending
              ? "Génération…"
              : `Générer ${monthsCount > 0 ? monthsCount : ""} tranche${monthsCount > 1 ? "s" : ""}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function countMonths(
  fromYear: number,
  fromMonth: number,
  toYear: number,
  toMonth: number
): number {
  if (toYear < fromYear || (toYear === fromYear && toMonth < fromMonth)) {
    return 0;
  }
  return (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
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

// ─────────── Modal édition annuelle d'une mission par jours/mois ───────────

type MissionYearData = {
  mission: {
    id: string;
    reference: string;
    title: string;
    dailyRate: number;
    vatRate: number;
    startDate: string;
    endDate: string;
    companyName: string | null;
    companyId: string | null;
  };
  milestones: {
    id: string;
    label: string;
    amount: number;
    status: string;
    expectedAt: string | null;
    paidAt: string | null;
    comment: string | null;
    month: number | null;
  }[];
};

function MissionYearEditModal({
  missionId,
  year,
  onClose
}: {
  missionId: string;
  year: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<MissionYearData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  // État local des jours par mois (1-12) — initialisé depuis les milestones existants
  const [daysByMonth, setDaysByMonth] = useState<Record<number, number>>({});

  // États d'édition mission — PRÉFIXÉS pour ne PAS shadow mission.dailyRate /
  // mission.vatRate / mission.startDate / mission.endDate dans les closures
  const [isEditingMission, setIsEditingMission] = useState(false);
  const [editedDailyRate, setEditedDailyRate] = useState<number>(0);
  const [editedVatRate, setEditedVatRate] = useState<number>(21);
  const [editedStartDate, setEditedStartDate] = useState<string>("");
  const [editedEndDate, setEditedEndDate] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const result = await getMissionMilestonesYear(missionId, year);
        setData(result as MissionYearData);
        // Pré-remplit les states d'édition mission depuis les valeurs actuelles
        setEditedDailyRate(result.mission.dailyRate);
        setEditedVatRate(result.mission.vatRate);
        setEditedStartDate(result.mission.startDate);
        setEditedEndDate(result.mission.endDate);
        // Pré-remplit : pour chaque milestone existant, days = amount / dailyRate
        const init: Record<number, number> = {};
        for (const ms of result.milestones) {
          if (ms.month && result.mission.dailyRate > 0) {
            init[ms.month] = Math.round((ms.amount / result.mission.dailyRate) * 10) / 10;
          }
        }
        setDaysByMonth(init);
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      } finally {
        setLoading(false);
      }
    })();
  }, [missionId, year]);

  function saveMissionEdits() {
    if (!data) return;
    const fd = new FormData();
    fd.set("missionId", missionId);
    fd.set("newDailyRate", String(editedDailyRate));
    fd.set("newVatRate", String(editedVatRate));
    fd.set("newStartDate", editedStartDate);
    fd.set("newEndDate", editedEndDate);
    start(async () => {
      try {
        const res = await updateMissionFromCashflow(fd);
        toast.success(
          res?.generated && res.generated > 0
            ? `Mission mise à jour (+${res.generated} tranches générées pour la prolongation)`
            : "Mission mise à jour"
        );
        setIsEditingMission(false);
        // Recharge les données
        const result = await getMissionMilestonesYear(missionId, year);
        setData(result as MissionYearData);
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      }
    });
  }

  function setDays(month: number, val: number) {
    setDaysByMonth((prev) => ({ ...prev, [month]: val }));
  }

  function save() {
    if (!data) return;
    const fd = new FormData();
    fd.set("missionId", missionId);
    fd.set("year", String(year));
    fd.set("daysByMonth", JSON.stringify(daysByMonth));
    start(async () => {
      try {
        const r = await updateMissionDaysBulk(fd);
        toast.success(
          `${r.updated} mises à jour, ${r.created} créées, ${r.deleted} supprimées`
        );
        onClose();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (loading) {
    return (
      <Modal title="Chargement…" onClose={onClose}>
        <div className="text-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-midnight-400 mx-auto" />
        </div>
      </Modal>
    );
  }
  if (!data) return null;

  const { mission, milestones } = data;
  const milestonesByMonth = new Map<number, typeof milestones[number]>();
  for (const m of milestones) {
    if (m.month) milestonesByMonth.set(m.month, m);
  }

  // Total annuel calculé (HTVA + TVAC pour l'affichage)
  const totalDays = Object.values(daysByMonth).reduce(
    (s, d) => s + (d || 0),
    0
  );
  const totalAmount = Math.round(totalDays * mission.dailyRate * 100) / 100;
  const totalAmountTvac =
    Math.round(totalAmount * (1 + mission.vatRate / 100) * 100) / 100;

  return (
    <Modal
      title={`${mission.reference} — ${mission.title}${mission.companyName ? ` (${mission.companyName})` : ""}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        {/* Bloc Détails mission — éditable */}
        <div className="rounded border border-indigo-200 bg-indigo-50/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Détails mission
            </h4>
            <div className="flex gap-2 text-[11px]">
              <a
                href={`/missions/${mission.id}`}
                target="_blank"
                className="text-indigoaccent hover:underline"
              >
                Page complète ↗
              </a>
              {!isEditingMission ? (
                <button
                  type="button"
                  onClick={() => setIsEditingMission(true)}
                  className="text-indigoaccent hover:underline inline-flex items-center gap-1"
                >
                  <Pencil className="w-3 h-3" /> Modifier
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingMission(false);
                    setEditedDailyRate(mission.dailyRate);
                    setEditedVatRate(mission.vatRate);
                    setEditedStartDate(mission.startDate);
                    setEditedEndDate(mission.endDate);
                  }}
                  className="text-midnight-500 hover:text-midnight-900"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
          {!isEditingMission ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div>
                <div className="text-midnight-500">Taux journalier</div>
                <div className="font-semibold tabular-nums">
                  {mission.dailyRate} €/j HTVA
                </div>
              </div>
              <div>
                <div className="text-midnight-500">TVA</div>
                <div className="font-semibold tabular-nums">{mission.vatRate}%</div>
              </div>
              <div>
                <div className="text-midnight-500">Du</div>
                <div className="font-semibold">{mission.startDate}</div>
              </div>
              <div>
                <div className="text-midnight-500">Au</div>
                <div className="font-semibold">{mission.endDate}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-midnight-500">
                    Taux/j (HTVA)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editedDailyRate}
                    onChange={(ev) => setEditedDailyRate(Number(ev.target.value) || 0)}
                    className="input text-sm text-right tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-midnight-500">
                    TVA %
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={editedVatRate}
                    onChange={(ev) => setEditedVatRate(Number(ev.target.value) || 0)}
                    className="input text-sm text-right tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-midnight-500">Du</label>
                  <input
                    type="date"
                    value={editedStartDate}
                    onChange={(ev) => setEditedStartDate(ev.target.value)}
                    className="input text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-midnight-500">Au</label>
                  <input
                    type="date"
                    value={editedEndDate}
                    onChange={(ev) => setEditedEndDate(ev.target.value)}
                    className="input text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={saveMissionEdits}
                  disabled={pending}
                  className="btn-primary text-xs disabled:opacity-50"
                >
                  <Save className="w-3 h-3" /> Enregistrer mission
                </button>
              </div>
              <p className="text-[10px] text-midnight-500 italic">
                💡 Changer le taux ne touche pas les tranches déjà créées
                (chacune garde son taux d'origine).
              </p>
            </div>
          )}
        </div>

        <div className="text-xs text-midnight-600">
          Taux journalier : <strong>{mission.dailyRate} €</strong> · TVA{" "}
          <strong>{mission.vatRate}%</strong>. Tape les jours prestés mois
          par mois. Le montant TVAC affiché est ce que tu encaisses. Mettre
          <strong> 0 jours</strong> supprime la tranche du mois.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[55vh] overflow-y-auto">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
            const existing = milestonesByMonth.get(month);
            const days = daysByMonth[month] ?? 0;
            const amount = Math.round(days * mission.dailyRate * 100) / 100;
            const isPaid = existing?.status === "PAID";
            return (
              <div
                key={month}
                className={
                  "rounded border p-2.5 " +
                  (isPaid
                    ? "border-emerald-300 bg-emerald-50/40"
                    : "border-midnight-200 bg-white")
                }
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-midnight-700">
                    {MONTH_LABELS[month - 1]} {year}
                  </span>
                  {isPaid && (
                    <span className="badge-success text-[10px]">Payé</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={days || ""}
                    onChange={(e) =>
                      setDays(month, Number(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="input flex-1 text-right tabular-nums text-sm py-1"
                    disabled={isPaid}
                  />
                  <span className="text-[10px] text-midnight-400">j</span>
                </div>
                <div
                  className={
                    "text-right text-xs tabular-nums mt-1 " +
                    (amount > 0
                      ? "text-emerald-700 font-semibold"
                      : "text-midnight-300")
                  }
                >
                  {amount > 0 ? fmtShort(amount) + " €" : "—"}
                </div>
                {existing?.comment && (
                  <div className="text-[10px] text-midnight-400 mt-1 truncate">
                    {existing.comment}
                  </div>
                )}
                {isPaid && (
                  <div className="text-[10px] text-emerald-600 mt-0.5">
                    Verrouillé (déjà payé)
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Récap */}
        <div className="rounded bg-indigo-50 border border-indigo-200 p-2 text-sm flex items-center justify-between">
          <span className="text-indigo-900">
            <strong>{totalDays}j</strong> × <strong>{mission.dailyRate}€</strong> = HTVA
          </span>
          <span className="font-bold tabular-nums text-indigo-700">
            {fmtShort(totalAmount)} € · TVAC {fmtShort(totalAmountTvac)}€ sur {year}
          </span>
        </div>

        <div className="text-[11px] text-midnight-500">
          💡 Les mois marqués <strong>Payé</strong> sont verrouillés ici. Pour
          les modifier malgré tout, passe par le clic sur la cellule dans la grille.
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-midnight-200">
          <button type="button" onClick={onClose} className="btn-secondary">
            Annuler
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="btn-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {pending ? "Sauvegarde…" : "Tout sauvegarder"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────── Modal d'édition des milestones d'une cellule ───────────

type MilestoneData = {
  id: string;
  label: string;
  amount: number;
  status: string;
  expectedAt: string | null;
  paidAt: string | null;
  comment: string | null;
  missionId: string | null;
  /** Snapshot du taux journalier à la création de la tranche. */
  appliedDailyRate: number | null;
  mission: {
    id: string;
    reference: string;
    dailyRate: number;
  } | null;
};

function MilestoneCellModal({
  rowLabel,
  monthIdx,
  year,
  milestoneIds,
  missionId,
  onClose
}: {
  rowLabel: string;
  monthIdx: number;
  year: number;
  milestoneIds: string[];
  missionId?: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MilestoneData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch initial
  useEffect(() => {
    (async () => {
      try {
        const data = await getMilestonesByIds(milestoneIds);
        setItems(data as MilestoneData[]);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [milestoneIds]);

  function refresh() {
    setLoading(true);
    getMilestonesByIds(milestoneIds)
      .then((data) => setItems(data as MilestoneData[]))
      .finally(() => setLoading(false));
  }

  return (
    <Modal
      title={`${rowLabel} — ${MONTH_LABELS[monthIdx]} ${year}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <p className="text-xs text-midnight-500">
          Édite chaque tranche individuellement : libellé, montant, statut.
          Utile pour ajuster un mois où il y a eu moins de jours prestés (ex :
          congés).
        </p>

        {loading && (
          <div className="text-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-midnight-400 mx-auto" />
          </div>
        )}

        {!loading && items && items.length === 0 && (
          <p className="text-sm text-midnight-500">
            Aucune tranche ce mois pour cette mission.
          </p>
        )}

        {!loading && items && items.map((m) => (
          <MilestoneEditCard
            key={m.id}
            milestone={m}
            onSaved={refresh}
            onDeleted={refresh}
          />
        ))}

        {/* Ajouter une tranche pour ce mois (si mission liée) */}
        {missionId && (
          showAddForm ? (
            <AddMilestoneForm
              missionId={missionId}
              year={year}
              month={monthIdx + 1}
              onSaved={() => {
                setShowAddForm(false);
                refresh();
                // Note : la nouvelle tranche n'est pas dans milestoneIds donc
                // on suggère un refresh de la page complète pour la voir.
                toast.info("Recharge la page pour voir la nouvelle tranche dans la grille");
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn-secondary w-full text-sm"
            >
              <Plus className="w-4 h-4" /> Ajouter une tranche ce mois
            </button>
          )
        )}

        <div className="flex justify-end pt-2 border-t border-midnight-200">
          <button type="button" onClick={onClose} className="btn-secondary">
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MilestoneEditCard({
  milestone,
  onSaved,
  onDeleted
}: {
  milestone: MilestoneData;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isPaid = milestone.status === "PAID";
  const isCancelled = milestone.status === "CANCELLED";
  const isLinkedToMission = !!milestone.mission;

  // Pour les tranches liées à une mission : édition uniquement des jours,
  // le label et le taux sont auto-générés à partir de la mission.
  // On utilise PRIORITAIREMENT appliedDailyRate (snapshot du rate au moment
  // de la création de la tranche), fallback sur mission.dailyRate sinon.
  // Sans ça, si le rate mission a changé après création de la tranche, le
  // calcul des jours initiaux serait faux.
  const effectiveRate =
    milestone.appliedDailyRate && milestone.appliedDailyRate > 0
      ? milestone.appliedDailyRate
      : milestone.mission?.dailyRate ?? 0;
  const initialDays =
    effectiveRate > 0
      ? Math.round((milestone.amount / effectiveRate) * 10) / 10
      : 0;
  const [days, setDays] = useState<number>(initialDays);

  // Pour les milestones standalone : édition libre
  const [label, setLabel] = useState(milestone.label);
  const [amount, setAmount] = useState(milestone.amount);
  const [comment, setComment] = useState(milestone.comment ?? "");
  const [pending, start] = useTransition();

  const dirty = isLinkedToMission
    ? days !== initialDays
    : label !== milestone.label ||
      amount !== milestone.amount ||
      (comment || "") !== (milestone.comment ?? "");

  function save() {
    if (isLinkedToMission) {
      const fd = new FormData();
      fd.set("id", milestone.id);
      fd.set("days", String(days));
      start(async () => {
        try {
          await updateMissionMilestoneDays(fd);
          toast.success(days === 0 ? "Tranche supprimée" : "Mise à jour");
          if (days === 0) onDeleted();
          else onSaved();
        } catch (e: any) {
          toast.error(e?.message ?? "Erreur");
        }
      });
      return;
    }
    const fd = new FormData();
    fd.set("id", milestone.id);
    fd.set("label", label);
    fd.set("amount", String(amount));
    fd.set("comment", comment);
    start(async () => {
      try {
        await updateBillingMilestone(fd);
        toast.success("Mise à jour");
        onSaved();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  // Flux normal : PLANNED → READY → INVOICED → PAID.
  // Dé-payer une facture déjà émise = retour à INVOICED (la facture existe
  // toujours côté client, elle n'est juste pas encore encaissée), pas à READY.
  // Avant le fix on retombait à READY, ce qui sortait la ligne du KPI
  // "En cours" (qui somme uniquement les INVOICED), créant l'impression que
  // le KPI ne remontait pas.
  function togglePaid() {
    start(async () => {
      try {
        await setMilestoneStatus(milestone.id, isPaid ? ("INVOICED" as any) : "PAID");
        toast.success(isPaid ? "Marqué non payé (retour à facturé)" : "Marqué payé ✓");
        onSaved();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  // Statut INVOICED = facture émise et envoyée au client, en attente de
  // paiement. Toggle vers/depuis READY. (Pas vers PLANNED — INVOICED suppose
  // que la tranche était déjà prête à facturer.)
  function toggleInvoiced() {
    const isInvoiced = milestone.status === "INVOICED";
    start(async () => {
      try {
        await setMilestoneStatus(milestone.id, isInvoiced ? "READY" : "INVOICED" as any);
        toast.success(isInvoiced ? "Revenu en prêt à facturer" : "Marqué facturé ✓");
        onSaved();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function del() {
    if (!confirm(`Supprimer la tranche « ${milestone.label} » ?`)) return;
    start(async () => {
      try {
        await deleteBillingMilestoneFromCashflow(milestone.id);
        toast.success("Supprimée");
        onDeleted();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  // Calcul auto pour les missions
  const dailyRate = milestone.mission?.dailyRate ?? 0;
  const computedAmount = isLinkedToMission
    ? Math.round(days * dailyRate * 100) / 100
    : amount;

  return (
    <div
      className={
        "rounded border p-3 space-y-2 " +
        (isPaid
          ? "bg-emerald-50/40 border-emerald-200"
          : isCancelled
          ? "bg-midnight-50 border-midnight-200 opacity-60"
          : "bg-white border-midnight-200")
      }
    >
      {/* En-tête : libellé en lecture seule pour mission, éditable sinon */}
      {isLinkedToMission ? (
        <div>
          <div className="text-[10px] uppercase text-midnight-500 tracking-wider mb-0.5">
            Tranche mission
          </div>
          <div className="text-sm font-medium text-midnight-800 truncate">
            {milestone.label}
          </div>
          <div className="text-[10px] text-midnight-500 mt-0.5">
            Taux : <strong>{dailyRate} €/j</strong> · libellé auto-généré
          </div>
        </div>
      ) : (
        <div>
          <label className="text-[10px] uppercase text-midnight-500 tracking-wider">
            Libellé
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="input w-full text-sm"
            disabled={isCancelled}
          />
        </div>
      )}

      {/* Édition principale : jours pour mission, montant pour standalone */}
      {isLinkedToMission ? (
        <div className="grid grid-cols-3 gap-2 items-end">
          <div className="col-span-1">
            <label className="text-[10px] uppercase text-midnight-500 tracking-wider">
              Jours prestés
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={days || ""}
              onChange={(e) => setDays(Number(e.target.value) || 0)}
              className="input w-full text-sm text-right tabular-nums"
              disabled={isCancelled || isPaid}
              placeholder="0"
            />
          </div>
          <div className="col-span-1 text-center pb-2 text-midnight-400 text-sm">
            × {dailyRate} =
          </div>
          <div className="col-span-1 text-right">
            <label className="text-[10px] uppercase text-midnight-500 tracking-wider block">
              Montant
            </label>
            <div className="text-base font-bold tabular-nums text-emerald-700">
              {fmtShort(computedAmount)} €
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase text-midnight-500 tracking-wider">
              Montant (€)
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="input w-full text-sm text-right tabular-nums"
              disabled={isCancelled}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase text-midnight-500 tracking-wider">
              Statut
            </label>
            <div className="flex items-center gap-2 h-9">
              <span
                className={
                  "badge-" +
                  (isPaid
                    ? "success"
                    : isCancelled
                    ? "neutral"
                    : "info")
                }
              >
                {milestone.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {!isLinkedToMission && (
        <div>
          <label className="text-[10px] uppercase text-midnight-500 tracking-wider">
            Commentaire
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="input w-full text-xs"
            placeholder="Ex: congés en août → 10j au lieu de 20"
            disabled={isCancelled}
          />
        </div>
      )}
      {isPaid && isLinkedToMission && (
        <div className="text-[10px] text-emerald-700 italic">
          🔒 Tranche payée, modifications désactivées (annuler le paiement
          pour changer les jours)
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-midnight-100">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={toggleInvoiced}
            disabled={pending || isCancelled || isPaid}
            className={
              "text-xs px-2 py-1 rounded " +
              (milestone.status === "INVOICED"
                ? "bg-indigoaccent/20 text-indigoaccent hover:bg-indigoaccent/30"
                : "bg-midnight-100 hover:bg-indigoaccent/20 text-midnight-700")
            }
            title="Facture émise et envoyée au client, en attente de paiement"
          >
            {pending ? (
              <Loader2 className="w-3 h-3 inline animate-spin" />
            ) : milestone.status === "INVOICED" ? (
              <>
                <Check className="w-3 h-3 inline" /> Facturé
              </>
            ) : (
              "Marquer facturé"
            )}
          </button>
          <button
            type="button"
            onClick={togglePaid}
            disabled={pending || isCancelled}
            className={
              "text-xs px-2 py-1 rounded " +
              (isPaid
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-midnight-100 hover:bg-emerald-100 text-midnight-700")
            }
          >
            {pending ? (
              <Loader2 className="w-3 h-3 inline animate-spin" />
            ) : isPaid ? (
              <>
                <Check className="w-3 h-3 inline" /> Payé
              </>
            ) : (
              "Marquer payé"
            )}
          </button>
          <button
            type="button"
            onClick={del}
            disabled={pending}
            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3 inline" />
          </button>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || pending || isCancelled}
          className="btn-primary text-xs px-2 py-1 disabled:opacity-40"
        >
          <Save className="w-3 h-3" />
          {pending ? "..." : "Sauvegarder"}
        </button>
      </div>
    </div>
  );
}

function AddMilestoneForm({
  missionId,
  year,
  month,
  onSaved,
  onCancel
}: {
  missionId: string;
  year: number;
  month: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        fd.set("missionId", missionId);
        fd.set("year", String(year));
        fd.set("month", String(month));
        start(async () => {
          try {
            await addBillingMilestoneToMission(fd);
            toast.success("Tranche ajoutée");
            onSaved();
          } catch (e: any) {
            toast.error(e?.message ?? "Erreur");
          }
        });
      }}
      className="rounded border border-emerald-200 bg-emerald-50/40 p-3 space-y-2"
    >
      <div className="text-xs font-semibold text-emerald-900 mb-1">
        Nouvelle tranche
      </div>
      <input
        name="label"
        placeholder="Libellé (ex: Bonus, Avance, Régul...)"
        required
        className="input text-sm"
      />
      <input
        name="amount"
        type="number"
        step="0.01"
        min="0"
        placeholder="Montant €"
        required
        className="input text-sm text-right tabular-nums"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-secondary text-xs">
          Annuler
        </button>
        <button disabled={pending} className="btn-primary text-xs">
          <Plus className="w-3 h-3" />
          {pending ? "..." : "Créer"}
        </button>
      </div>
    </form>
  );
}

// ─────────── Modal léger d'édition d'un OneOff (cellule de groupe) ───────────

type OneOffSnapshot = {
  id: string;
  label: string;
  amount: number;
  status: string;
  date: string;
  category: string | null;
};

function OneOffCellEditModal({
  oneOffId,
  onClose
}: {
  oneOffId: string;
  onClose: () => void;
}) {
  const [snap, setSnap] = useState<OneOffSnapshot | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [pending, start] = useTransition();
  const [editedAmount, setEditedAmount] = useState<number>(0);
  const [editedStatus, setEditedStatus] = useState<"PLANNED" | "PAID" | "SKIPPED">(
    "PLANNED"
  );

  // État local pour afficher un message INLINE au lieu d'un toast fugitif
  const [orphanError, setOrphanError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const data = await getOneOffById(oneOffId);
        if (!data) {
          // L'entrée n'existe plus en DB. On reste dans le modal pour laisser
          // l'utilisateur LIRE le message + cliquer sur "Rafraîchir la page".
          setOrphanError(
            "Cette entrée a été supprimée ou regénérée. Clique 'Rafraîchir la page' pour synchroniser."
          );
          return;
        }
        setSnap(data as OneOffSnapshot);
        setEditedAmount(data.amount);
        setEditedStatus(data.status as any);
      } catch (err: any) {
        setOrphanError(err?.message ?? "Erreur de chargement");
      } finally {
        setLoadingData(false);
      }
    })();
  }, [oneOffId]);

  // Si on a une erreur d'entrée orpheline, on affiche un mini bandeau dans le modal
  if (orphanError) {
    return (
      <div className="fixed inset-0 z-50 bg-midnight-900/40 grid place-items-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3">
          <h3 className="text-base font-semibold text-midnight-900">
            Entrée introuvable
          </h3>
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {orphanError}
          </div>
          <p className="text-[11px] text-midnight-500">
            Ça arrive parfois après un changement de simulation ou un deploy
            récent : ton onglet a un état périmé. Un refresh suffit.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-secondary text-xs">
              Fermer
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="btn-primary text-xs"
            >
              Rafraîchir la page
            </button>
          </div>
        </div>
      </div>
    );
  }

  function save() {
    const fd = new FormData();
    fd.set("id", oneOffId);
    fd.set("amount", String(editedAmount));
    fd.set("status", editedStatus);
    start(async () => {
      try {
        await updateOneOffCell(fd);
        toast.success("Mise à jour");
        onClose();
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      }
    });
  }

  function delEntry() {
    if (!confirm("Supprimer cette entrée pour ce mois ?")) return;
    start(async () => {
      try {
        // cascadeGroup = false : on ne supprime QUE ce mois, pas tout le groupe
        await deleteOneOffEntry(oneOffId, false);
        toast.success("Supprimée");
        onClose();
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      }
    });
  }

  if (loadingData) {
    return (
      <Modal title="Chargement…" onClose={onClose}>
        <div className="text-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-midnight-400 mx-auto" />
        </div>
      </Modal>
    );
  }
  if (!snap) return null;

  return (
    <Modal title={snap.label} onClose={onClose}>
      <div className="space-y-3">
        <div className="text-xs text-midnight-500">
          {snap.category && (
            <>
              Catégorie : <strong>{snap.category}</strong> ·{" "}
            </>
          )}
          Date : <strong>{snap.date}</strong>
        </div>

        <div>
          <label className="text-[10px] uppercase text-midnight-500 tracking-wider">
            Montant (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={editedAmount}
            onChange={(ev) => setEditedAmount(Number(ev.target.value) || 0)}
            className="input w-full text-right tabular-nums text-lg font-semibold"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[10px] uppercase text-midnight-500 tracking-wider">
            Statut
          </label>
          <select
            value={editedStatus}
            onChange={(ev) => setEditedStatus(ev.target.value as any)}
            className="input w-full"
          >
            <option value="PLANNED">⏰ Prévu</option>
            <option value="PAID">✓ Payé / Encaissé</option>
            <option value="SKIPPED">⊘ Sauté ce mois</option>
          </select>
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t border-midnight-200">
          <button
            type="button"
            onClick={delEntry}
            disabled={pending}
            className="text-red-600 hover:text-red-700 disabled:opacity-40 text-xs flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Supprimer ce mois
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Annuler
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="btn-primary text-xs disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              {pending ? "…" : "Enregistrer"}
            </button>
          </div>
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
  const isRecurring =
    row.kind === "recurring_expense" || row.kind === "recurring_income";
  // Cellule Payroll (Salaires / Précompte / ONSS agrégés) → mini-form
  // dédié : statut PLANNED/PAID/SKIPPED + montant réel (override facultatif).
  const isPayroll = !!cell.payroll;
  return (
    <Modal
      title={`${row.label} — ${monthLabel} ${year}`}
      onClose={onClose}
    >
      {isPayroll && cell.payroll ? (
        <PayrollCellForm
          year={cell.payroll.year}
          month={cell.payroll.month}
          kind={cell.payroll.kind}
          currentAmount={cell.amount}
          currentStatus={cell.status}
          onClose={onClose}
        />
      ) : isRecurring && row.recurringId ? (
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

/**
 * Mini-formulaire d'édition d'une cellule Payroll (Salaires / Précompte / ONSS).
 * Deux actions : changer le statut (PAID / PLANNED / SKIPPED) et corriger
 * le montant réel constaté (facultatif — utile quand la banque a débité
 * un montant différent du calculé agrégé).
 */
function PayrollCellForm({
  year, month, kind, currentAmount, currentStatus, onClose
}: {
  year: number;
  month: number;
  kind: "NET_PAY" | "WITHHOLDING_TAX" | "ONSS";
  currentAmount: number;
  currentStatus: "PLANNED" | "INVOICED" | "PAID" | "SKIPPED" | "VIRTUAL";
  onClose: () => void;
}) {
  const [pendingStatus, startStatus] = useTransition();
  const [pendingAmount, startAmount] = useTransition();
  const [amount, setAmount] = useState(String(currentAmount.toFixed(2)));

  function apply(status: "PLANNED" | "PAID" | "SKIPPED") {
    startStatus(async () => {
      try {
        await setPayrollMonthStatus(year, month, kind, status);
        toast.success("Statut mis à jour");
        onClose();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  function saveAmount(e: React.FormEvent) {
    e.preventDefault();
    const v = Number(amount);
    if (!Number.isFinite(v) || v < 0) { toast.error("Montant invalide"); return; }
    startAmount(async () => {
      try {
        await setPayrollMonthAmount(year, month, kind, v);
        toast.success("Montant ajusté");
        onClose();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  const kindLabel =
    kind === "NET_PAY" ? "Salaires (net)" :
    kind === "WITHHOLDING_TAX" ? "Précompte professionnel" : "ONSS";

  return (
    <div className="space-y-4">
      <p className="text-sm text-midnight-600">
        Cellule payroll <strong>{kindLabel}</strong> — le montant est calculé
        automatiquement depuis les employés actifs ce mois. Tu peux marquer
        cette échéance comme payée ou l'ajuster si la banque a débité un
        montant différent.
      </p>

      <div>
        <div className="text-xs uppercase text-midnight-500 mb-1">Statut</div>
        <div className="flex gap-2">
          <button
            disabled={pendingStatus}
            onClick={() => apply("PAID")}
            className={"btn-sm " + (currentStatus === "PAID" ? "btn-primary bg-emerald-600 hover:bg-emerald-700" : "btn-ghost")}
          >
            <Check className="w-3 h-3" /> Payée
          </button>
          <button
            disabled={pendingStatus}
            onClick={() => apply("PLANNED")}
            className={"btn-sm " + (currentStatus === "PLANNED" ? "btn-primary" : "btn-ghost")}
          >
            À venir
          </button>
          <button
            disabled={pendingStatus}
            onClick={() => apply("SKIPPED")}
            className={"btn-sm " + (currentStatus === "SKIPPED" ? "btn-primary bg-midnight-600" : "btn-ghost")}
          >
            <X className="w-3 h-3" /> Sautée
          </button>
        </div>
      </div>

      <form onSubmit={saveAmount} className="border-t border-midnight-100 pt-3">
        <label className="label">Ajuster le montant réel (facultatif)</label>
        <div className="flex gap-2">
          <input
            type="number" step="0.01" className="input flex-1"
            value={amount} onChange={(e) => setAmount(e.target.value)}
          />
          <button type="submit" disabled={pendingAmount} className="btn-primary">
            {pendingAmount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
        <p className="text-[11px] text-midnight-500 mt-1">
          Le montant saisi ici prime sur le calcul agrégé. Vide pour revenir
          au calcul automatique.
        </p>
      </form>
    </div>
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
