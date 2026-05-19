"use client";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { CashflowWeeks, WeeklyRow } from "@/lib/cashflow-weekly";
import { formatCurrency } from "@/lib/utils";

export function WeeklyGrid({ data }: { data: CashflowWeeks }) {
  const { weeks, rows, weekTotals, startingBalance } = data;

  // Sections : Recettes en haut, Dépenses en bas, chacune groupée par catégorie
  const sections = useMemo(() => {
    const incomeRows = rows.filter((r) => r.isIncome);
    const expenseRows = rows.filter((r) => !r.isIncome);
    const groupByCategory = (rs: WeeklyRow[]) => {
      const map = new Map<string, WeeklyRow[]>();
      for (const r of rs) {
        const k = r.category;
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(r);
      }
      return Array.from(map.entries()).sort(([a], [b]) =>
        a.localeCompare(b, "fr")
      );
    };
    return {
      income: groupByCategory(incomeRows),
      expense: groupByCategory(expenseRows)
    };
  }, [rows]);

  // Par défaut TOUT déplié (utile en 13 semaines on a moins de lignes qu'en annuel)
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});
  const toggle = (k: string) =>
    setCollapsedCats((c) => ({ ...c, [k]: !c[k] }));

  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-midnight-200 bg-midnight-50">
            <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-midnight-50 z-10 min-w-[220px]">
              Ligne
            </th>
            {weeks.map((w) => (
              <th
                key={w.index}
                className="text-right px-2 py-2 font-semibold whitespace-nowrap min-w-[90px]"
                title={`${w.startDate.toLocaleDateString("fr-BE")} → ${w.endDate.toLocaleDateString("fr-BE")}`}
              >
                {w.label}
              </th>
            ))}
            <th className="text-right px-3 py-2 font-semibold min-w-[90px]">
              Total
            </th>
          </tr>
        </thead>

        <tbody>
          {/* RECETTES */}
          <SectionBlock
            title="Recettes (TVAC)"
            tone="emerald"
            grouped={sections.income}
            weeks={weeks}
            collapsedCats={collapsedCats}
            toggle={toggle}
          />
          {/* DÉPENSES */}
          <SectionBlock
            title="Dépenses"
            tone="red"
            grouped={sections.expense}
            weeks={weeks}
            collapsedCats={collapsedCats}
            toggle={toggle}
          />
        </tbody>

        <tfoot>
          {/* Solde début */}
          <tr className="border-t border-midnight-300 bg-midnight-100/60">
            <td className="px-3 py-2 font-semibold sticky left-0 bg-midnight-100 z-10">
              Solde projeté début
            </td>
            <td
              colSpan={weeks.length + 1}
              className="px-3 py-2 text-left text-midnight-700"
            >
              <span
                className={`font-semibold tabular-nums ${
                  startingBalance >= 0 ? "text-midnight-900" : "text-red-700"
                }`}
              >
                {formatCurrency(startingBalance)}
              </span>
              <span className="text-midnight-500 ml-2">
                au {weeks[0].startDate.toLocaleDateString("fr-BE")}
              </span>
            </td>
          </tr>

          {/* Net par semaine */}
          <tr className="bg-midnight-50">
            <td className="px-3 py-2 font-semibold sticky left-0 bg-midnight-50 z-10">
              Net semaine
            </td>
            {weekTotals.map((wt, i) => (
              <td
                key={i}
                className={`px-2 py-2 text-right tabular-nums font-semibold ${
                  wt.net > 0
                    ? "text-emerald-700"
                    : wt.net < 0
                    ? "text-red-700"
                    : "text-midnight-400"
                }`}
              >
                {wt.net === 0 ? "—" : formatCurrency(wt.net)}
              </td>
            ))}
            <td
              className={`px-3 py-2 text-right font-bold tabular-nums ${
                data.totalNet >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {formatCurrency(data.totalNet)}
            </td>
          </tr>

          {/* Solde projeté fin de semaine */}
          <tr className="border-t-2 border-midnight-400 bg-indigo-50">
            <td className="px-3 py-2 font-bold sticky left-0 bg-indigo-50 z-10">
              Solde projeté fin
            </td>
            {weekTotals.map((wt, i) => (
              <td
                key={i}
                className={`px-2 py-2 text-right tabular-nums font-bold ${
                  wt.endingBalance < 0
                    ? "text-red-700"
                    : wt.endingBalance < startingBalance * 0.3
                    ? "text-amber-700"
                    : "text-midnight-900"
                }`}
                title={
                  wt.endingBalance < 0
                    ? "Solde négatif projeté !"
                    : undefined
                }
              >
                {formatCurrency(wt.endingBalance)}
              </td>
            ))}
            <td className="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────── Section (Recettes / Dépenses) ───────────

function SectionBlock({
  title,
  tone,
  grouped,
  weeks,
  collapsedCats,
  toggle
}: {
  title: string;
  tone: "emerald" | "red";
  grouped: [string, WeeklyRow[]][];
  weeks: CashflowWeeks["weeks"];
  collapsedCats: Record<string, boolean>;
  toggle: (k: string) => void;
}) {
  const totalCol = weeks.length + 2;
  const sectionTotal = useMemo(() => {
    const cells = weeks.map(() => 0);
    let tot = 0;
    for (const [, rs] of grouped) {
      for (const r of rs) {
        for (let i = 0; i < weeks.length; i++) {
          cells[i] += r.cells[i].amount;
        }
        tot += r.total;
      }
    }
    return { cells, tot };
  }, [grouped, weeks]);

  const titleColor = tone === "emerald" ? "text-emerald-800" : "text-red-800";
  const bgHeader =
    tone === "emerald" ? "bg-emerald-50" : "bg-red-50";

  return (
    <>
      <tr className={`border-t-2 border-midnight-300 ${bgHeader}`}>
        <td
          className={`px-3 py-2 font-bold sticky left-0 z-10 ${bgHeader} ${titleColor}`}
        >
          {title}
        </td>
        {sectionTotal.cells.map((v, i) => (
          <td
            key={i}
            className={`px-2 py-2 text-right tabular-nums font-bold ${titleColor}`}
          >
            {v === 0 ? "" : formatCurrency(Math.abs(v))}
          </td>
        ))}
        <td className={`px-3 py-2 text-right font-bold ${titleColor}`}>
          {formatCurrency(Math.abs(sectionTotal.tot))}
        </td>
      </tr>

      {grouped.length === 0 && (
        <tr>
          <td
            colSpan={totalCol}
            className="px-3 py-3 text-midnight-400 italic text-center"
          >
            Aucune ligne sur ces 13 semaines
          </td>
        </tr>
      )}

      {grouped.map(([cat, rs]) => {
        const isCollapsed = collapsedCats[cat] ?? false;
        const catCells = weeks.map(() => 0);
        let catTotal = 0;
        for (const r of rs) {
          for (let i = 0; i < weeks.length; i++) catCells[i] += r.cells[i].amount;
          catTotal += r.total;
        }
        return (
          <Fragment key={`${tone}-${cat}`}>
            <tr
              className="bg-midnight-50/60 cursor-pointer hover:bg-midnight-100"
              onClick={() => toggle(cat)}
            >
              <td className="px-3 py-1.5 sticky left-0 z-10 bg-midnight-50/60">
                <span className="flex items-center gap-1.5 font-semibold text-midnight-700">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                  {cat}
                  <span className="text-midnight-400 font-normal">
                    ({rs.length})
                  </span>
                </span>
              </td>
              {catCells.map((v, i) => (
                <td
                  key={i}
                  className="px-2 py-1.5 text-right tabular-nums font-semibold text-midnight-700"
                >
                  {v === 0 ? "" : formatCurrency(Math.abs(v))}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right font-semibold text-midnight-700">
                {formatCurrency(Math.abs(catTotal))}
              </td>
            </tr>
            {!isCollapsed &&
              rs.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-midnight-100 hover:bg-midnight-50/40"
                >
                  <td className="px-3 py-1.5 pl-8 sticky left-0 bg-white z-10">
                    <span className="text-midnight-800 truncate">{r.label}</span>
                  </td>
                  {r.cells.map((c, i) => (
                    <td
                      key={i}
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        c.amount === 0
                          ? "text-midnight-300"
                          : c.paid
                          ? "text-emerald-700 font-medium"
                          : "text-midnight-800"
                      }`}
                      title={c.paid ? "Payé / encaissé" : undefined}
                    >
                      {c.amount === 0 ? "" : formatCurrency(Math.abs(c.amount))}
                      {c.paid && c.amount !== 0 && (
                        <span className="text-emerald-600 ml-0.5">✓</span>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular-nums text-midnight-800">
                    {formatCurrency(Math.abs(r.total))}
                  </td>
                </tr>
              ))}
          </Fragment>
        );
      })}
    </>
  );
}
