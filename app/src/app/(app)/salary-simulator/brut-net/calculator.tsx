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
  ArrowUpFromLine,
  Car,
  ShieldCheck,
  Utensils,
  Leaf,
  Briefcase
} from "lucide-react";
import {
  computeNetFromGross,
  computeGrossFromNet,
  FAMILY_SITUATION_LABELS,
  type FamilySituation,
  type SalaryBreakdownBe,
  type SalaryOptions
} from "@/lib/belgian-salary";

type Mode = "brut2net" | "net2brut";

export function BrutNetCalculator() {
  const [mode, setMode] = useState<Mode>("brut2net");
  const [grossText, setGrossText] = useState<string>("4500");
  const [netText, setNetText] = useState<string>("");

  // Situation familiale
  const [situation, setSituation] = useState<FamilySituation>("single");
  const [children, setChildren] = useState<number>(0);
  const [disabledChildren, setDisabledChildren] = useState<number>(0);
  const [disabledSelf, setDisabledSelf] = useState<boolean>(false);

  // Avantages & cotisations
  const [carAtn, setCarAtn] = useState<number>(0);
  const [groupIns, setGroupIns] = useState<number>(0);
  const [hospiIns, setHospiIns] = useState<number>(0);
  const [mvEmployerShare, setMvEmployerShare] = useState<number>(0);
  const [mvEmployeeShare, setMvEmployeeShare] = useState<number>(0);
  const [mvDays, setMvDays] = useState<number>(20);
  const [ecoVouchers, setEcoVouchers] = useState<number>(0);
  const [repFees, setRepFees] = useState<number>(0);

  const opts: SalaryOptions = useMemo(
    () => ({
      situation,
      dependentChildren: children,
      disabledChildren,
      disabledSelf,
      carAtnMonthly: carAtn,
      groupInsuranceEmployee: groupIns,
      hospitalInsuranceEmployee: hospiIns,
      mealVoucherEmployerShare: mvEmployerShare,
      mealVoucherEmployeeShare: mvEmployeeShare,
      mealVoucherDaysPerMonth: mvDays,
      ecoVouchersMonthly: ecoVouchers,
      representationFeesMonthly: repFees
    }),
    [
      situation,
      children,
      disabledChildren,
      disabledSelf,
      carAtn,
      groupIns,
      hospiIns,
      mvEmployerShare,
      mvEmployeeShare,
      mvDays,
      ecoVouchers,
      repFees
    ]
  );

  const breakdown: SalaryBreakdownBe = useMemo(() => {
    if (mode === "brut2net") {
      return computeNetFromGross(parseNum(grossText), opts);
    }
    return computeGrossFromNet(parseNum(netText), opts);
  }, [mode, grossText, netText, opts]);

  // Synchronise l'autre champ
  useEffect(() => {
    if (mode === "brut2net") {
      setNetText(numToText(breakdown.netSalaryCash));
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

      <div className="grid lg:grid-cols-12 gap-5">
        {/* COLONNE GAUCHE : SAISIES (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Saisie principale */}
          <section className="card p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-indigo-500" /> Saisie principale
            </h3>
            {mode === "brut2net" ? (
              <LabeledNum
                label="Brut mensuel"
                suffix="€"
                value={grossText}
                onChange={setGrossText}
                hint="Brut sur 12 mois (le 13ᵉ est compté à part)"
                big
              />
            ) : (
              <LabeledNum
                label="Net cash souhaité"
                suffix="€"
                value={netText}
                onChange={setNetText}
                hint="Net en main, hors avantages"
                big
              />
            )}
          </section>

          {/* Situation familiale */}
          <section className="card p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-indigo-500" /> Situation
              familiale
            </h3>

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
                <NumInputInt
                  value={children}
                  onChange={setChildren}
                  min={0}
                  max={10}
                />
              </div>
              <div>
                <label className="text-xs text-midnight-600 mb-1 block">
                  Dont handicapés
                </label>
                <NumInputInt
                  value={disabledChildren}
                  onChange={setDisabledChildren}
                  min={0}
                  max={children}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-midnight-700">
              <input
                type="checkbox"
                checked={disabledSelf}
                onChange={(e) => setDisabledSelf(e.target.checked)}
              />
              Travailleur handicapé reconnu
            </label>
          </section>

          {/* Avantages en nature & cotisations */}
          <section className="card p-5">
            <h3 className="font-semibold mb-1 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-500" /> Avantages &
              cotisations
            </h3>
            <p className="text-[11px] text-midnight-500 mb-3">
              Tout ce qui modifie le précompte ou s'ajoute au pouvoir d'achat.
            </p>

            <SubField
              icon={Car}
              label="ATN voiture mensuel"
              hint="Avantage en nature taxable (différent du TCO)"
              suffix="€/mois"
              value={carAtn}
              onChange={setCarAtn}
              step={10}
            />
            <SubField
              icon={ShieldCheck}
              label="Cot. assurance groupe (employé)"
              hint="Part payée par le travailleur — déductible"
              suffix="€/mois"
              value={groupIns}
              onChange={setGroupIns}
              step={5}
            />
            <SubField
              icon={ShieldCheck}
              label="Cot. hospi/famille (employé)"
              hint="Ex: extension conjoint + enfants"
              suffix="€/mois"
              value={hospiIns}
              onChange={setHospiIns}
              step={5}
            />

            <div className="my-3 border-t border-midnight-200 pt-3">
              <div className="text-xs font-medium text-midnight-700 mb-2 flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-indigo-400" /> Chèques-repas
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-midnight-500 block mb-0.5">
                    Part employeur
                  </label>
                  <NumInputDecimal
                    value={mvEmployerShare}
                    onChange={setMvEmployerShare}
                    step={0.1}
                    suffix="€/j"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-midnight-500 block mb-0.5">
                    Part employé
                  </label>
                  <NumInputDecimal
                    value={mvEmployeeShare}
                    onChange={setMvEmployeeShare}
                    step={0.1}
                    suffix="€/j"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-midnight-500 block mb-0.5">
                    Jours/mois
                  </label>
                  <NumInputInt
                    value={mvDays}
                    onChange={setMvDays}
                    min={0}
                    max={31}
                  />
                </div>
              </div>
              <div className="text-[10px] text-midnight-400">
                Légal : employeur max 6.91€/j · employé min 1.09€/j
              </div>
            </div>

            <SubField
              icon={Leaf}
              label="Éco-chèques"
              hint="250€/an = 20.83€/mois max légal"
              suffix="€/mois"
              value={ecoVouchers}
              onChange={setEcoVouchers}
              step={1}
            />
            <SubField
              icon={Receipt}
              label="Frais de représentation"
              hint="Forfait net non taxé (max ~150€/mois sans justif)"
              suffix="€/mois"
              value={repFees}
              onChange={setRepFees}
              step={10}
            />
          </section>
        </div>

        {/* COLONNE MILIEU : DÉTAIL DÉDUCTIONS (4 cols) */}
        <div className="lg:col-span-4">
          <section className="card p-5 h-full">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-500" /> Détail mensuel
            </h3>

            <div className="space-y-2.5 text-sm">
              <Line label="Brut mensuel" value={breakdown.grossMonthly} bold />
              <Line
                label="− ONSS travailleur"
                value={-breakdown.onssWorker}
                hint="13.07% du brut"
                negative
              />
              <Sep />
              <Line
                label="Brut imposable"
                value={breakdown.grossTaxable}
              />
              {breakdown.carAtn > 0 && (
                <Line
                  label="+ ATN voiture"
                  value={breakdown.carAtn}
                  hint="Avantage en nature ajouté à l'imposable"
                  positive
                />
              )}
              {breakdown.groupInsuranceEmployee > 0 && (
                <Line
                  label="− Cot. assurance groupe"
                  value={-breakdown.groupInsuranceEmployee}
                  hint="Déductible avant précompte"
                  negative
                />
              )}
              {breakdown.hospitalInsuranceEmployee > 0 && (
                <Line
                  label="− Cot. hospi/famille"
                  value={-breakdown.hospitalInsuranceEmployee}
                  negative
                />
              )}
              <Line
                label="Base précompte"
                value={breakdown.taxableBase}
                bold
              />
              <Line
                label="− Précompte (brut)"
                value={-breakdown.precompteRaw}
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
                hint="Plafonnée ~61€/mois"
                negative
              />
              {breakdown.mealVoucherEmployeeMonthly > 0 && (
                <Line
                  label="− Chèques-repas (part employé)"
                  value={-breakdown.mealVoucherEmployeeMonthly}
                  hint={`${(opts.mealVoucherEmployeeShare ?? 0).toFixed(2)}€ × ${opts.mealVoucherDaysPerMonth}j`}
                  negative
                />
              )}
              <Sep />
              <Line
                label="Net cash / mois"
                value={breakdown.netSalaryCash}
                big
              />
            </div>
          </section>
        </div>

        {/* COLONNE DROITE : RÉSUMÉ POUVOIR D'ACHAT (4 cols) */}
        <div className="lg:col-span-4">
          <section className="card p-5 bg-gradient-to-br from-emerald-50/40 to-transparent border-emerald-100 h-full">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Coins className="w-4 h-4" /> Pouvoir d'achat
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
                    Net cash /mois
                  </div>
                  <div className="text-xl font-bold tabular-nums text-emerald-700">
                    {fmt(breakdown.netSalaryCash)} €
                  </div>
                </div>
              </div>

              {breakdown.untaxedAdvantagesMonthly > 0 && (
                <div className="card p-3 border-emerald-200 bg-emerald-50/60">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 mb-2">
                    + Avantages non taxés /mois
                  </div>
                  <div className="space-y-1 text-xs">
                    {breakdown.mealVoucherEmployerMonthly > 0 && (
                      <div className="flex justify-between">
                        <span className="text-midnight-600 flex items-center gap-1">
                          <Utensils className="w-3 h-3" /> Chèques-repas
                        </span>
                        <span className="tabular-nums font-medium">
                          {fmt(breakdown.mealVoucherEmployerMonthly)} €
                        </span>
                      </div>
                    )}
                    {breakdown.ecoVouchersMonthly > 0 && (
                      <div className="flex justify-between">
                        <span className="text-midnight-600 flex items-center gap-1">
                          <Leaf className="w-3 h-3" /> Éco-chèques
                        </span>
                        <span className="tabular-nums font-medium">
                          {fmt(breakdown.ecoVouchersMonthly)} €
                        </span>
                      </div>
                    )}
                    {breakdown.representationFeesMonthly > 0 && (
                      <div className="flex justify-between">
                        <span className="text-midnight-600 flex items-center gap-1">
                          <Receipt className="w-3 h-3" /> Frais représ.
                        </span>
                        <span className="tabular-nums font-medium">
                          {fmt(breakdown.representationFeesMonthly)} €
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-emerald-700 pt-1 border-t border-emerald-200 mt-1">
                      <span>Total avantages</span>
                      <span className="tabular-nums">
                        {fmt(breakdown.untaxedAdvantagesMonthly)} €
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="card p-3 bg-emerald-600 text-white">
                <div className="text-[10px] uppercase tracking-wider opacity-80">
                  Pouvoir d'achat total /mois
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {fmt(breakdown.totalPurchasingPower)} €
                </div>
                {breakdown.untaxedAdvantagesMonthly > 0 && (
                  <div className="text-[10px] opacity-80 mt-0.5">
                    cash + avantages utilisables
                  </div>
                )}
              </div>

              {breakdown.carAtn > 0 && (
                <div className="text-[11px] text-midnight-500 pt-1 flex items-start gap-1.5">
                  <Car className="w-3 h-3 shrink-0 mt-0.5" />
                  <span>
                    Voiture de société : non incluse dans le cash mais
                    bénéfice d'usage (TCO réel typiquement &gt; ATN).
                  </span>
                </div>
              )}

              <div className="pt-3 border-t border-midnight-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-midnight-500">
                    Brut annuel (×13.92)
                  </div>
                  <div className="font-semibold tabular-nums">
                    {fmt(breakdown.grossAnnual)} €
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-midnight-500">
                    Pouvoir d'achat /an
                  </div>
                  <div className="font-semibold tabular-nums text-emerald-700">
                    {fmt(breakdown.totalPurchasingPowerAnnual)} €
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-midnight-200">
                <div className="text-xs text-midnight-500">
                  Taux de prélèvement effectif (salaire seul)
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-midnight-900 tabular-nums">
                    {breakdown.effectiveTaxRate.toFixed(1)}%
                  </span>
                  <span className="text-xs text-midnight-500">
                    ({fmt(breakdown.totalDeductionsMonthly)}€)
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-midnight-200 text-[11px] text-midnight-500 flex items-start gap-1.5">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  Estimation indicative — barèmes 2025 simplifiés. Précision
                  ±3-5%. Pour la fiche de paie officielle, voir un logiciel
                  payroll certifié.
                </span>
              </div>
            </div>
          </section>
        </div>
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
  onChange,
  big
}: {
  label: string;
  suffix?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  big?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-midnight-600 mb-1 flex items-center justify-between">
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
        className={`input w-full text-right tabular-nums ${big ? "text-lg font-bold" : "font-semibold"}`}
      />
      {hint && (
        <div className="text-[10px] text-midnight-400 mt-1">{hint}</div>
      )}
    </div>
  );
}

function SubField({
  icon: Icon,
  label,
  hint,
  suffix,
  value,
  onChange,
  step = 1
}: {
  icon: any;
  label: string;
  hint?: string;
  suffix?: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  const [text, setText] = useState<string>(value === 0 ? "" : String(value));
  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (parsed !== value) setText(value === 0 ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="mb-3 last:mb-0">
      <label className="text-xs text-midnight-700 mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          {Icon && <Icon className="w-3.5 h-3.5 text-midnight-400 shrink-0" />}
          <span className="truncate">{label}</span>
        </span>
        {suffix && (
          <span className="text-[10px] text-midnight-400">{suffix}</span>
        )}
      </label>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const cleaned = e.target.value
            .replace(",", ".")
            .replace(/[^\d.]/g, "");
          setText(cleaned);
          if (cleaned === "" || cleaned === ".") {
            onChange(0);
            return;
          }
          const n = Number(cleaned);
          if (Number.isFinite(n)) onChange(n);
        }}
        placeholder="0"
        className="input w-full text-right tabular-nums text-sm"
      />
      {hint && (
        <div className="text-[10px] text-midnight-400 mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function NumInputInt({
  value,
  onChange,
  min,
  max
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) =>
        onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))
      }
      className="input w-full text-right tabular-nums text-sm"
    />
  );
}

function NumInputDecimal({
  value,
  onChange,
  step,
  suffix
}: {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  suffix?: string;
}) {
  const [text, setText] = useState<string>(value === 0 ? "" : String(value));
  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (parsed !== value) setText(value === 0 ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const cleaned = e.target.value
          .replace(",", ".")
          .replace(/[^\d.]/g, "");
        setText(cleaned);
        if (cleaned === "" || cleaned === ".") {
          onChange(0);
          return;
        }
        const n = Number(cleaned);
        if (Number.isFinite(n)) onChange(n);
      }}
      placeholder={suffix ? `0 ${suffix}` : "0"}
      className="input w-full text-right tabular-nums text-sm"
    />
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
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div
          className={
            bold || big
              ? "font-semibold text-midnight-900"
              : "text-midnight-700"
          }
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

function Sep() {
  return <div className="h-px bg-midnight-200" />;
}

function describeReductions(opts: SalaryOptions): string {
  const parts: string[] = [];
  if (opts.dependentChildren > 0)
    parts.push(
      `${opts.dependentChildren} enfant${opts.dependentChildren > 1 ? "s" : ""}`
    );
  if (opts.disabledChildren && opts.disabledChildren > 0)
    parts.push(`dont ${opts.disabledChildren} handi.`);
  if (opts.situation === "married_single") parts.push("quotient conjugal");
  if (opts.disabledSelf) parts.push("travailleur handi.");
  return parts.join(", ") || "—";
}

function parseNum(v: string): number {
  if (!v || v === "." || v === "-") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numToText(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  return String(Math.round(n * 100) / 100);
}

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-BE", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Math.round(n));
}
