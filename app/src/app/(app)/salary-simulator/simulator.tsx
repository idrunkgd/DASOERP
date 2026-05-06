"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calculator,
  Save,
  Wallet,
  Car,
  Utensils,
  Leaf,
  ShieldCheck,
  Hospital,
  Smartphone,
  Receipt,
  TrendingUp,
  RefreshCw
} from "lucide-react";
import {
  computeSalary,
  DAYS_PER_YEAR_PER_WEEKDAY,
  DEFAULT_SALARY_INPUTS,
  type SalaryInputs
} from "@/lib/salary-calc";
import { saveSalaryScenario } from "@/server/actions/salary-scenarios";

type CandidateOption = { id: string; label: string };

type InitialValues = SalaryInputs & {
  candidateId?: string | null;
  label?: string;
  notes?: string | null;
};

export function Simulator({
  candidates,
  initial
}: {
  candidates: CandidateOption[];
  initial: InitialValues;
}) {
  const router = useRouter();
  const [pending, startSave] = useTransition();

  const [candidateId, setCandidateId] = useState<string>(
    initial.candidateId ?? ""
  );
  const [label, setLabel] = useState<string>(initial.label ?? "");
  const [notes, setNotes] = useState<string>(initial.notes ?? "");

  const [inputs, setInputs] = useState<SalaryInputs>({
    grossMonthly: initial.grossMonthly,
    monthsPerYear: initial.monthsPerYear,
    employerChargesPct: initial.employerChargesPct,
    workingDaysPerWeek: initial.workingDaysPerWeek ?? 5,
    workingDaysPerYear: initial.workingDaysPerYear,
    carMonthlyTco: initial.carMonthlyTco,
    mealVoucherEmployerPerDay: initial.mealVoucherEmployerPerDay,
    ecoVouchersAnnual: initial.ecoVouchersAnnual,
    groupInsurancePct: initial.groupInsurancePct,
    hospitalInsuranceMonthly: initial.hospitalInsuranceMonthly,
    phoneInternetMonthly: initial.phoneInternetMonthly,
    netExpensesMonthly: initial.netExpensesMonthly,
    targetMarginPct: initial.targetMarginPct,
    soldDailyRate: initial.soldDailyRate ?? 0
  });

  function set<K extends keyof SalaryInputs>(key: K, v: number) {
    setInputs((s) => ({ ...s, [key]: v }));
  }

  /**
   * Quand on change le régime hebdo, on recalcule automatiquement les
   * jours prestés/an (220 jours pour un 5/5, soit 44 par jour). L'utilisateur
   * peut toujours éditer manuellement le champ "Jours prestés/an" ensuite.
   */
  function setRegime(v: number) {
    setInputs((s) => ({
      ...s,
      workingDaysPerWeek: v,
      workingDaysPerYear: Math.round(v * DAYS_PER_YEAR_PER_WEEKDAY)
    }));
  }

  const breakdown = useMemo(() => computeSalary(inputs), [inputs]);

  function reset() {
    setInputs(DEFAULT_SALARY_INPUTS);
  }

  /** Génère un libellé par défaut quand l'utilisateur n'en a pas saisi. */
  function buildDefaultLabel(): string {
    const cand = candidates.find((c) => c.id === candidateId);
    const candPart = cand
      ? cand.label.split(" · ")[0] // "Lastname Firstname"
      : null;
    const brutPart = `${Math.round(inputs.grossMonthly)}€/mois`;
    const extras: string[] = [];
    if (inputs.carMonthlyTco > 0) extras.push("voiture");
    if (inputs.workingDaysPerWeek !== 5)
      extras.push(`${inputs.workingDaysPerWeek}/5`);
    const tail = extras.length ? ` + ${extras.join(" + ")}` : "";
    return candPart ? `${candPart} — ${brutPart}${tail}` : `Brut ${brutPart}${tail}`;
  }

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const finalLabel = label.trim() || buildDefaultLabel();
    if (!label.trim()) {
      // On affiche dans l'input pour que l'utilisateur voie ce qui est sauvé
      setLabel(finalLabel);
    }
    const fd = new FormData();
    fd.set("candidateId", candidateId);
    fd.set("label", finalLabel);
    fd.set("notes", notes);
    Object.entries(inputs).forEach(([k, v]) => fd.set(k, String(v)));
    startSave(async () => {
      try {
        await saveSalaryScenario(fd);
        toast.success(
          candidateId
            ? "Simulation sauvegardée et liée au candidat"
            : "Simulation sauvegardée"
        );
        // Recharge la page sans le paramètre ?scenario pour repartir frais
        router.replace("/salary-simulator");
        router.refresh();
      } catch (e: any) {
        const msg = e?.message ?? "Erreur lors de la sauvegarde";
        // Détecte les erreurs Prisma "table not found" courantes en dev
        if (
          /does not exist|relation .* does not exist|P2021/i.test(msg)
        ) {
          toast.error(
            "La table n'existe pas en base. Lancez `npm run db:migrate` puis redémarrez."
          );
        } else {
          toast.error(msg);
        }
      }
    });
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      {/* === En-tête : candidat + libellé === */}
      <section className="card p-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-midnight-600 mb-1 block">
              Candidat (optionnel)
            </label>
            <select
              value={candidateId}
              onChange={(e) => setCandidateId(e.target.value)}
              className="input w-full"
            >
              <option value="">— Simulation libre (non rattachée) —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-midnight-600 mb-1 block">
              Libellé de la simulation
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Auto si vide : « ${buildDefaultLabel()} »`}
              className="input w-full"
              maxLength={120}
            />
            <div className="text-[10px] text-midnight-400 mt-1">
              Laissez vide pour un libellé généré automatiquement.
            </div>
          </div>
        </div>
      </section>

      {/* === Inputs === */}
      <div className="grid lg:grid-cols-3 gap-5">
        <section className="card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-indigo-500" /> Salaire de base
          </h3>
          <NumField
            label="Brut mensuel demandé"
            suffix="€"
            value={inputs.grossMonthly}
            onChange={(v) => set("grossMonthly", v)}
            step={50}
          />
          <NumField
            label="Mensualités/an"
            hint="13.92 = 12 mois + 13e + double pécule"
            value={inputs.monthsPerYear}
            onChange={(v) => set("monthsPerYear", v)}
            step={0.01}
          />
          <NumField
            label="Charges patronales"
            suffix="%"
            hint="ONSS patronale + cotisations (Belgique ≈ 25-27%)"
            value={inputs.employerChargesPct}
            onChange={(v) => set("employerChargesPct", v)}
            step={0.5}
          />

          {/* Régime hebdomadaire — presets cliquables + valeur libre */}
          <div className="mb-3">
            <label className="text-xs font-medium text-midnight-600 flex items-center justify-between gap-2 mb-1">
              <span>Régime</span>
              <span className="text-[10px] text-midnight-400 font-normal">
                jours/semaine
              </span>
            </label>
            <div className="grid grid-cols-5 gap-1 mb-1.5">
              {[5, 4, 3, 2, 1].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setRegime(d)}
                  className={`text-xs py-1 rounded border ${
                    inputs.workingDaysPerWeek === d
                      ? "bg-indigo-100 border-indigo-300 text-indigo-800 font-medium"
                      : "border-midnight-200 hover:bg-midnight-50"
                  }`}
                >
                  {d}/5
                </button>
              ))}
            </div>
            <RegimeInput
              value={inputs.workingDaysPerWeek}
              onChange={setRegime}
            />
            <div className="text-[10px] text-midnight-400 mt-1">
              Met à jour automatiquement les jours prestés/an
            </div>
          </div>

          <NumField
            label="Jours prestés/an"
            hint="Convention Dasolabs : 261 ouvrés − 32 congés − 10 fériés ≈ 219 (régime 5/5)"
            value={inputs.workingDaysPerYear}
            onChange={(v) => set("workingDaysPerYear", v)}
            step={1}
          />
        </section>

        <section className="card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Car className="w-4 h-4 text-indigo-500" /> Voiture & mobilité
          </h3>
          <NumField
            label="Voiture — TCO mensuel"
            suffix="€"
            hint="Leasing + carburant/élec + assurance + entretien"
            value={inputs.carMonthlyTco}
            onChange={(v) => set("carMonthlyTco", v)}
            step={25}
          />
          <NumField
            label="Frais nets mensuels"
            suffix="€"
            hint="Forfait représentatif (max ~150€/mois sans justif)"
            value={inputs.netExpensesMonthly}
            onChange={(v) => set("netExpensesMonthly", v)}
            step={10}
          />
          <NumField
            label="GSM + internet"
            suffix="€/mois"
            hint="× 12 dans le calcul du coût annuel"
            value={inputs.phoneInternetMonthly}
            onChange={(v) => set("phoneInternetMonthly", v)}
            step={5}
          />
        </section>

        <section className="card p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Utensils className="w-4 h-4 text-indigo-500" /> Avantages annexes
          </h3>
          <NumField
            label="Chèques-repas — coût employeur"
            suffix="€/jour"
            hint="8.91€/jour (Dasolabs — coût réel incluant les frais de gestion)"
            value={inputs.mealVoucherEmployerPerDay}
            onChange={(v) => set("mealVoucherEmployerPerDay", v)}
            step={0.1}
          />
          <NumField
            label="Éco-chèques (annuel)"
            suffix="€"
            hint="Max légal : 250€/an"
            value={inputs.ecoVouchersAnnual}
            onChange={(v) => set("ecoVouchersAnnual", v)}
            step={10}
          />
          <NumField
            label="Assurance groupe"
            suffix="% brut"
            hint="Cotisation patronale (typiquement 4-8% du brut annuel)"
            value={inputs.groupInsurancePct}
            onChange={(v) => set("groupInsurancePct", v)}
            step={0.25}
          />
          <NumField
            label="Hospi + autres assurances"
            suffix="€/mois"
            hint="× 12 dans le calcul du coût annuel"
            value={inputs.hospitalInsuranceMonthly}
            onChange={(v) => set("hospitalInsuranceMonthly", v)}
            step={5}
          />
        </section>
      </div>

      {/* === Résultats côte à côte === */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Coût interne */}
        <section className="card p-6 bg-gradient-to-br from-indigo-50/50 to-transparent border-indigo-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Calculator className="w-4 h-4" /> Coût employeur
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-indigo-600 font-semibold">
              Interne — sans marge
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <Line
              label="Brut annuel"
              value={breakdown.grossAnnual}
              hint={`${inputs.grossMonthly.toFixed(0)}€ × ${inputs.monthsPerYear}`}
            />
            <Line
              label="Charges patronales"
              value={breakdown.employerChargesAnnual}
              hint={`${inputs.employerChargesPct}% du brut`}
            />
            <Line
              label="Sous-total brut chargé"
              value={breakdown.totalGrossLoaded}
              bold
            />
            <Sep />
            {breakdown.carAnnual > 0 && (
              <Line
                label="Voiture (12 × TCO)"
                value={breakdown.carAnnual}
                icon={Car}
              />
            )}
            {breakdown.mealVouchersAnnual > 0 && (
              <Line
                label="Chèques-repas"
                value={breakdown.mealVouchersAnnual}
                hint={`${inputs.mealVoucherEmployerPerDay}€ × ${inputs.workingDaysPerYear} jours`}
                icon={Utensils}
              />
            )}
            {breakdown.ecoVouchersAnnual > 0 && (
              <Line
                label="Éco-chèques"
                value={breakdown.ecoVouchersAnnual}
                icon={Leaf}
              />
            )}
            {breakdown.groupInsuranceAnnual > 0 && (
              <Line
                label="Assurance groupe"
                value={breakdown.groupInsuranceAnnual}
                icon={ShieldCheck}
              />
            )}
            {breakdown.hospitalInsuranceAnnual > 0 && (
              <Line
                label="Hospi + autres"
                value={breakdown.hospitalInsuranceAnnual}
                icon={Hospital}
              />
            )}
            {breakdown.phoneInternetAnnual > 0 && (
              <Line
                label="GSM/internet"
                value={breakdown.phoneInternetAnnual}
                icon={Smartphone}
              />
            )}
            {breakdown.netExpensesAnnual > 0 && (
              <Line
                label="Frais nets (12 mois)"
                value={breakdown.netExpensesAnnual}
                icon={Receipt}
              />
            )}
            {breakdown.benefitsAnnual > 0 && (
              <>
                <Line
                  label="Sous-total avantages"
                  value={breakdown.benefitsAnnual}
                  bold
                />
                <Sep />
              </>
            )}
            <Line
              label="Coût annuel total"
              value={breakdown.totalAnnualCost}
              big
            />
          </div>

          <div className="mt-5 pt-5 border-t border-midnight-200">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-midnight-500">
                  Coût journalier
                </div>
                <div className="text-3xl font-bold text-midnight-900 tabular-nums">
                  {fmt(breakdown.costPerDay)}€
                </div>
              </div>
              <div className="text-xs text-midnight-500 text-right">
                Coût/an ÷ {inputs.workingDaysPerYear} jours
              </div>
            </div>
          </div>
        </section>

        {/* TJM facturable */}
        <section className="card p-6 bg-gradient-to-br from-emerald-50/50 to-transparent border-emerald-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> TJM facturable
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">
              Avec marge cible
            </span>
          </div>

          {/* TJM vendu réel : si > 0, on affiche la marge effective */}
          <div className="mb-4 p-3 rounded border border-emerald-200 bg-white">
            <label className="text-xs font-medium text-midnight-700 flex items-center justify-between mb-1">
              <span>TJM réellement vendu</span>
              <span className="text-[10px] text-midnight-400 font-normal">
                facturé au client (laisser à 0 si pas encore défini)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <SoldRateInput
                value={inputs.soldDailyRate}
                onChange={(v) => set("soldDailyRate", v)}
              />
              <span className="text-sm text-midnight-500">€</span>
              {inputs.soldDailyRate > 0 && (
                <button
                  type="button"
                  onClick={() => set("soldDailyRate", 0)}
                  className="text-[10px] text-midnight-500 hover:text-red-600 px-1"
                  title="Effacer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Marge réelle si TJM vendu, sinon marge cible */}
          {inputs.soldDailyRate > 0 ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-midnight-500">
                  Marge réelle (TJM vendu vs coût)
                </div>
                <div className="flex items-baseline gap-3 mt-1">
                  <span
                    className={`text-4xl font-bold tabular-nums ${
                      breakdown.actualMarginPerDay >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {breakdown.actualMarginPerDay >= 0 ? "+" : ""}
                    {fmt(breakdown.actualMarginPerDay)}€
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      breakdown.actualMarginPct >= 0
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {breakdown.actualMarginPct >= 0 ? "+" : ""}
                    {breakdown.actualMarginPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-xs text-midnight-500 mt-0.5">
                  par jour ·{" "}
                  <span
                    className={
                      breakdown.actualMarginAnnual >= 0
                        ? "text-emerald-700 font-semibold"
                        : "text-red-700 font-semibold"
                    }
                  >
                    {breakdown.actualMarginAnnual >= 0 ? "+" : ""}
                    {fmt(breakdown.actualMarginAnnual)}€
                  </span>{" "}
                  sur l'année ({inputs.workingDaysPerYear} jours)
                </div>
              </div>

              {/* Comparaison avec marge cible */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-midnight-200 text-center">
                <div>
                  <div className="text-[10px] uppercase text-midnight-400 tracking-wider">
                    TJM coût
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-midnight-700">
                    {fmt(breakdown.costPerDay)}€
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-midnight-400 tracking-wider">
                    TJM vendu
                  </div>
                  <div className="text-sm font-bold tabular-nums text-emerald-700">
                    {fmt(inputs.soldDailyRate)}€
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-midnight-400 tracking-wider">
                    Suggéré ({inputs.targetMarginPct.toFixed(0)}%)
                  </div>
                  <div className="text-sm tabular-nums text-midnight-500">
                    {fmt(breakdown.billableRate)}€
                  </div>
                </div>
              </div>

              {/* Slider marge cible toujours visible pour ajuster */}
              <div className="pt-2">
                <label className="text-[10px] font-medium text-midnight-500 flex items-center justify-between mb-1">
                  <span>Marge cible (référence)</span>
                  <span>{inputs.targetMarginPct.toFixed(0)}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={inputs.targetMarginPct}
                  onChange={(e) =>
                    set("targetMarginPct", Number(e.target.value))
                  }
                  className="w-full accent-emerald-600"
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-midnight-600 flex items-center justify-between mb-1">
                  <span>Marge cible</span>
                  <span className="font-semibold text-emerald-700">
                    {inputs.targetMarginPct.toFixed(0)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={inputs.targetMarginPct}
                  onChange={(e) =>
                    set("targetMarginPct", Number(e.target.value))
                  }
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-midnight-400 mt-0.5">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div>
                  <div className="text-xs uppercase tracking-wider text-midnight-500">
                    TJM facturable suggéré
                  </div>
                  <div className="text-4xl font-bold text-emerald-700 tabular-nums">
                    {fmt(breakdown.billableRate)}€
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t border-midnight-200">
                  <div>
                    <div className="text-[10px] uppercase text-midnight-500 tracking-wider">
                      Marge / jour
                    </div>
                    <div className="font-semibold text-emerald-700 tabular-nums">
                      +{fmt(breakdown.marginPerDay)}€
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-midnight-500 tracking-wider">
                      Marge annuelle
                    </div>
                    <div className="font-semibold text-emerald-700 tabular-nums">
                      +{fmt(breakdown.marginAnnual)}€
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 text-center">
                  {[25, 35, 50].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => set("targetMarginPct", m)}
                      className={`text-xs py-1 rounded border ${
                        inputs.targetMarginPct === m
                          ? "bg-emerald-100 border-emerald-300 text-emerald-800 font-medium"
                          : "border-midnight-200 hover:bg-midnight-50"
                      }`}
                    >
                      {m}%
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* === Notes + boutons === */}
      <section className="card p-5">
        <label className="text-xs font-medium text-midnight-600 mb-1 block">
          Notes (optionnel)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="input w-full"
          placeholder="Hypothèses, références, points à valider…"
        />
        <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
          <button
            type="button"
            onClick={reset}
            className="btn-secondary text-sm"
          >
            <RefreshCw className="w-4 h-4" /> Réinitialiser
          </button>
          <button
            type="submit"
            disabled={pending}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {pending
              ? "Sauvegarde…"
              : candidateId
              ? "Sauvegarder sur ce candidat"
              : "Sauvegarder la simulation"}
          </button>
        </div>
      </section>
    </form>
  );
}

// ─────────── Composants utilitaires ───────────

/**
 * Champ numérique qui maintient son texte en interne pour permettre la
 * saisie de décimales ("8.91" était cassé avec une valeur `number`
 * contrôlée — Number("8.") repasse à 8 et le point disparaissait).
 * Affiche vide quand la valeur est 0, pour ne pas avoir un "0" coincé
 * devant la saisie.
 */
function NumField({
  label,
  hint,
  suffix,
  value,
  onChange,
  step = 1
}: {
  label: string;
  hint?: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const [text, setText] = useState<string>(numToText(value));

  // Resynchronise quand la valeur change EXTERNELLEMENT (preset cliqué,
  // reset, chargement de scénario). On ne touche pas au texte si la valeur
  // numérique correspond déjà à ce que l'utilisateur tape (ex : "8." parse
  // à 8, on laisse "8." en place).
  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (!Number.isFinite(parsed) || parsed !== value) {
      setText(numToText(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="mb-3 last:mb-0">
      <label className="text-xs font-medium text-midnight-600 flex items-center justify-between gap-2 mb-1">
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
        value={text}
        onChange={(e) => {
          // On normalise la virgule belge → point pour le parser
          const raw = e.target.value.replace(",", ".");
          // On garde uniquement chiffres + point (et le signe moins en début)
          const cleaned = raw.replace(/[^\d.-]/g, "");
          setText(cleaned);
          if (cleaned === "" || cleaned === "-" || cleaned === ".") {
            onChange(0);
            return;
          }
          const n = Number(cleaned);
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          // À la perte du focus, on reformatte proprement (supprime "8." etc.)
          if (text === "" || text === "." || text === "-") {
            setText("");
            onChange(0);
          } else {
            const n = Number(text);
            if (Number.isFinite(n)) setText(numToText(n));
          }
        }}
        placeholder="0"
        className="input w-full text-right tabular-nums"
      />
      {hint && (
        <div className="text-[10px] text-midnight-400 mt-1">{hint}</div>
      )}
    </div>
  );
}

function numToText(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  // Évite les ".00" inutiles tout en gardant les décimales utiles
  return String(n);
}

function RegimeInput({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState<string>(value === 5 ? "5" : numToText(value));
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
        const cleaned = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
        setText(cleaned);
        if (cleaned === "" || cleaned === ".") return;
        const n = Number(cleaned);
        if (Number.isFinite(n) && n > 0 && n <= 7) onChange(n);
      }}
      onBlur={() => {
        if (text === "" || text === ".") {
          setText("5");
          onChange(5);
        } else {
          const n = Number(text);
          if (Number.isFinite(n)) setText(String(n));
        }
      }}
      placeholder="5"
      className="input w-full text-right tabular-nums"
    />
  );
}

function SoldRateInput({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState<string>(numToText(value));
  useEffect(() => {
    const parsed = text === "" ? 0 : Number(text);
    if (parsed !== value) setText(numToText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const cleaned = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
        setText(cleaned);
        if (cleaned === "" || cleaned === ".") {
          onChange(0);
          return;
        }
        const n = Number(cleaned);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        if (text === "" || text === ".") {
          setText("");
          onChange(0);
        } else {
          const n = Number(text);
          if (Number.isFinite(n)) setText(numToText(n));
        }
      }}
      placeholder="0"
      className="input flex-1 text-right tabular-nums font-semibold"
    />
  );
}

function Line({
  label,
  value,
  hint,
  bold,
  big,
  icon: Icon
}: {
  label: string;
  value: number;
  hint?: string;
  bold?: boolean;
  big?: boolean;
  icon?: any;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        big ? "text-base pt-1" : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 ${
          bold || big ? "font-semibold text-midnight-900" : "text-midnight-700"
        }`}
      >
        {Icon && <Icon className="w-3.5 h-3.5 text-midnight-400" />}
        <span>{label}</span>
        {hint && (
          <span className="text-[10px] text-midnight-400 font-normal">
            ({hint})
          </span>
        )}
      </div>
      <div
        className={`tabular-nums ${
          big
            ? "text-lg font-bold text-midnight-900"
            : bold
            ? "font-semibold"
            : ""
        }`}
      >
        {fmt(value)}€
      </div>
    </div>
  );
}

function Sep() {
  return <div className="h-px bg-midnight-200" />;
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-BE", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Math.round(n));
}
