"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Wallet,
  Receipt,
  Coins,
  Users as UsersIcon,
  Info,
  ArrowDownToLine,
  ArrowUpFromLine
} from "lucide-react";
import {
  computeNetFromGross,
  computeGrossFromNet,
  FAMILY_SITUATION_LABELS,
  type FamilySituation,
  type SalaryBreakdownBe
} from "@/lib/belgian-salary";

type Mode = "brut2net" | "net2brut";

export function BrutNetCalculator() {
  const [mode, setMode] = useState<Mode>("brut2net");
  const [grossText, setGrossText] = useState<string>("4500");
  const [netText, setNetText] = useState<string>("");

  const [situation, setSituation] = useState<FamilySituation>("single");
  const [children, setChildren] = useState<number>(0);
  const [disabledChildren, setDisabledChildren] = useState<number>(0);
  const [disabledSelf, setDisabledSelf] = useState<boolean>(false);

  const opts = useMemo(
    () => ({
      situation,
      dependentChildren: children,
      disabledChildren,
      disabledSelf
    }),
    [situation, children, disabledChildren, disabledSelf]
  );

  const breakdown: SalaryBreakdownBe = useMemo(() => {
    if (mode === "brut2net") {
      const n = parseNum(grossText);
      return computeNetFromGross(n, opts);
    }
    const n = parseNum(netText);
    return computeGrossFromNet(n, opts);
  }, [mode, grossText, netText, opts]);

  // Synchronise l'autre champ quand le mode/inputs change
  useEffect(() => {
    if (mode === "brut2net") {
      setNetText(numToText(breakdown.netMonthly));
    } else {
      setGrossText(numToText(breakdown.grossMonthly));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakdown, mode]);

  function swap() {
    setMode((m) => (m === "brut2net" ? "net2brut" : "brut2net"));
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <ModeButton
          active={mode === "brut2net"}
          onClick={() => setMode("brut2net")}
          icon={ArrowDownToLine}
        >
          Brut → Net
        </ModeButton>
        <button
          type="button"
          onClick={swap}
          className="p-2 rounded-md hover:bg-midnight-100 text-midnight-600"
          title="Inverser"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <ModeButton
          active={mode === "net2brut"}
          onClick={() => setMode("net2brut")}
          icon={ArrowUpFromLine}
        >
          Net → Brut
        </ModeButton>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* INPUT */}
        <section className="card p-5 lg:col-span-1">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-500" /> Saisie
          </h3>

          {mode === "brut2net" ? (
            <LabeledNum
              label="Brut mensuel"
              suffix="€"
              value={grossText}
              onChange={setGrossText}
              hint="Brut sur 12 mois (le 13ᵉ mois est calculé séparément)"
            />
          ) : (
            <LabeledNum
              label="Net mensuel souhaité"
              suffix="€"
              value={netText}
              onChange={setNetText}
              hint="Net en main par mois"
            />
          )}

          <div className="mt-5 pt-5 border-t border-midnight-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-midnight-500 mb-3 flex items-center gap-1.5">
              <UsersIcon className="w-3.5 h-3.5" /> Situation familiale
            </h4>

            <div className="mb-3">
              <label className="text-xs text-midnight-600 mb-1 block">
                Statut
              </label>
              <select
                value={situation}
                onChange={(e) =>
                  setSituation(e.target.value as FamilySituation)
                }
                className="input w-full text-sm"
              >
                {Object.entries(FAMILY_SITUATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-midnight-600 mb-1 block">
                  Enfants à charge
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={children}
                  onChange={(e) =>
                    setChildren(
                      Math.max(0, Math.min(10, Number(e.target.value) || 0))
                    )
                  }
                  className="input w-full text-right tabular-nums"
                />
              </div>
              <div>
                <label className="text-xs text-midnight-600 mb-1 block">
                  Dont handicapés
                </label>
                <input
                  type="number"
                  min={0}
                  max={children}
                  value={disabledChildren}
                  onChange={(e) =>
                    setDisabledChildren(
                      Math.max(0, Math.min(children, Number(e.target.value) || 0))
                    )
                  }
                  className="input w-full text-right tabular-nums"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-midnight-700">
              <input
                type="checkbox"
                checked={disabledSelf}
                onChange={(e) => setDisabledSelf(e.target.checked)}
                className="rounded"
              />
              Travailleur handicapé reconnu
            </label>
          </div>
        </section>

        {/* DETAIL DEDUCTIONS */}
        <section className="card p-5 lg:col-span-1">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-500" /> Détail mensuel
          </h3>

          <div className="space-y-2.5 text-sm">
            <Line
              label="Brut mensuel"
              value={breakdown.grossMonthly}
              bold
            />
            <Line
              label="− ONSS travailleur"
              value={-breakdown.onssWorker}
              hint="13.07% du brut"
              negative
            />
            <div className="border-t border-midnight-200 my-1.5" />
            <Line
              label="Brut imposable"
              value={breakdown.grossTaxable}
              hint="Base pour le précompte"
            />
            <Line
              label="− Précompte (brut)"
              value={-breakdown.precompteRaw}
              hint="Tranches progressives"
              negative
            />
            {breakdown.precompteReductions > 0 && (
              <Line
                label="+ Réductions famille"
                value={breakdown.precompteReductions}
                hint={describeReductions(opts)}
                positive
              />
            )}
            <Line
              label="Précompte effectif"
              value={-breakdown.precompte}
              negative
              bold
            />
            <Line
              label="− Cot. spéciale SS"
              value={-breakdown.csss}
              hint="CSSS (plafonnée ~61€)"
              negative
            />
            <div className="border-t border-midnight-200 my-1.5" />
            <Line
              label="Net en main / mois"
              value={breakdown.netMonthly}
              big
            />
          </div>
        </section>

        {/* RECAP + ANNUEL */}
        <section className="card p-5 lg:col-span-1 bg-gradient-to-br from-emerald-50/40 to-transparent border-emerald-100">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Coins className="w-4 h-4" /> Résumé
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="card p-3 bg-white border-midnight-200">
                <div className="text-[10px] uppercase tracking-wider text-midnight-500">
                  Brut /mois
                </div>
                <div className="text-xl font-bold tabular-nums text-midnight-900">
                  {fmt(breakdown.grossMonthly)} €
                </div>
              </div>
              <div className="card p-3 bg-emerald-50 border-emerald-200">
                <div className="text-[10px] uppercase tracking-wider text-emerald-700">
                  Net /mois
                </div>
                <div className="text-xl font-bold tabular-nums text-emerald-700">
                  {fmt(breakdown.netMonthly)} €
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-midnight-500">
                  Brut annuel (×13.92)
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {fmt(breakdown.grossAnnual)} €
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-midnight-500">
                  Net annuel (×13.92)
                </div>
                <div className="text-sm font-semibold tabular-nums text-emerald-700">
                  {fmt(breakdown.netAnnual)} €
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-midnight-200">
              <div className="text-xs text-midnight-500">
                Taux de prélèvement effectif
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-midnight-900 tabular-nums">
                  {breakdown.effectiveTaxRate.toFixed(1)}%
                </span>
                <span className="text-xs text-midnight-500">
                  ({fmt(breakdown.totalDeductionsMonthly)}€ retiré par mois)
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-midnight-200 text-[11px] text-midnight-500 flex items-start gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              <span>
                Estimation indicative basée sur les barèmes 2025
                simplifiés. La fiche de paie réelle peut varier de ±3-5%
                selon les barèmes officiels du SPF Finances et
                d'éventuelles primes/déductions personnelles.
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─────────── Composants utilitaires ───────────

function ModeButton({
  children,
  active,
  onClick,
  icon: Icon
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
        (active
          ? "bg-indigo-600 text-white"
          : "bg-midnight-100 text-midnight-700 hover:bg-midnight-200")
      }
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}

function LabeledNum({
  label,
  suffix,
  hint,
  value,
  onChange
}: {
  label: string;
  suffix?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-midnight-600 mb-1 block flex items-center justify-between">
        <span>{label}</span>
        {suffix && (
          <span className="text-[10px] text-midnight-400 font-normal">
            {suffix}
          </span>
        )}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => {
          const cleaned = e.target.value
            .replace(",", ".")
            .replace(/[^\d.]/g, "");
          onChange(cleaned);
        }}
        placeholder="0"
        className="input w-full text-right tabular-nums text-lg font-semibold"
      />
      {hint && (
        <div className="text-[10px] text-midnight-400 mt-1">{hint}</div>
      )}
    </div>
  );
}

function Line({
  label,
  value,
  hint,
  bold,
  big,
  negative,
  positive
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
  big?: boolean;
  negative?: boolean;
  positive?: boolean;
}) {
  const color = big
    ? "text-emerald-700"
    : negative
    ? "text-red-700"
    : positive
    ? "text-emerald-700"
    : "text-midnight-900";
  return (
    <div className={`flex items-start justify-between gap-3`}>
      <div className="min-w-0">
        <div
          className={`${bold || big ? "font-semibold text-midnight-900" : "text-midnight-700"}`}
        >
          {label}
        </div>
        {hint && (
          <div className="text-[10px] text-midnight-400">{hint}</div>
        )}
      </div>
      <div
        className={`tabular-nums shrink-0 ${color} ${
          big ? "text-xl font-bold" : bold ? "font-semibold" : ""
        }`}
      >
        {value >= 0 ? fmt(value) : "-" + fmt(-value)} €
      </div>
    </div>
  );
}

function describeReductions(opts: {
  situation: string;
  dependentChildren: number;
  disabledChildren?: number;
  disabledSelf?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.dependentChildren > 0)
    parts.push(`${opts.dependentChildren} enfant${opts.dependentChildren > 1 ? "s" : ""}`);
  if (opts.disabledChildren && opts.disabledChildren > 0)
    parts.push(`dont ${opts.disabledChildren} handicapé(s)`);
  if (opts.situation === "married_single")
    parts.push("quotient conjugal");
  if (opts.disabledSelf) parts.push("travailleur handicapé");
  return parts.join(", ") || "—";
}

function parseNum(v: string): number {
  if (!v || v === "." || v === "-") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numToText(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return Math.round(n * 100) / 100 + "";
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-BE", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Math.round(n));
}
