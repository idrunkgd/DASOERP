"use client";
/**
 * Table des employés avec édition inline. Le formulaire d'ajout se déplie
 * en cliquant sur "+ Ajouter", et chaque ligne peut passer en mode édition
 * via l'icône crayon. Suppression via poubelle.
 */
import { useState, useTransition, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  createEmployee, updateEmployee, deleteEmployee
} from "@/server/actions/payroll-employees";
import { formatCurrency, formatDate } from "@/lib/utils";
import { computeBelgianPayroll } from "@/lib/belgian-payroll";
import { Plus, Loader2, Save, Trash2, Edit3, X, User as UserIcon, Sparkles } from "lucide-react";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  startDate: string;
  endDate: string | null;
  monthlyNetPay: number;
  monthlyWithholdingTax: number;
  monthlyOnss: number;
  monthlyGrossReference: number | null;
  monthsPerYear: number;
  notes: string | null;
  // Package avantages stocké sur PayrollEmployee
  carMonthlyTco?: number;
  mealVoucherEmployerPerDay?: number;
  ecoVouchersAnnual?: number;
  hospitalInsuranceMonthly?: number;
  phoneInternetMonthly?: number;
  netExpensesMonthly?: number;
  carFromFleet?: { plate: string; brand: string; model: string; amount: number } | null;
  candidateId?: string | null;
  userId?: string | null;
  sourceLink?: { href: string; label: string } | null;
  scenarioGross?: number | null;
  effectiveGross?: number | null;
  payrollCalc?: {
    net: number;
    withholdingTax: number;
    onssEmployee: number;
    totalEmployerCost: number;
  } | null;
  packageDetail?: {
    atnCar: number;
    atnPhone: number;
    atnHospital: number;
    mealVouchersNetMonthly: number;
    ecoVouchersNetMonthly: number;
    netExpensesMonthly: number;
    netCash: number;
    netTotalInHand: number;
    packageValueMonthly: number;
  } | null;
};

type ConsultantChoice = { id: string; firstName: string; lastName: string; email: string };

export function EmployeesTable({ employees, availableConsultants = [] }: { employees: Employee[]; availableConsultants?: ConsultantChoice[] }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Si la page a été ouverte avec ?candidateId=X ou ?userId=X (depuis le
  // bouton "Configurer la paie"), on ouvre auto le formulaire pré-rempli.
  const prefillCandidateId = searchParams.get("candidateId");
  const prefillUserId = searchParams.get("userId");
  const prefillFirstName = searchParams.get("firstName") ?? "";
  const prefillLastName = searchParams.get("lastName") ?? "";
  useEffect(() => {
    if ((prefillCandidateId || prefillUserId) && !adding) {
      setAdding(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillCandidateId, prefillUserId]);

  function closeAdd() {
    setAdding(false);
    // Nettoie la query string pour ne pas ré-ouvrir le form au prochain reload
    if (prefillCandidateId || prefillUserId) router.replace("/employees");
  }

  return (
    <>
      {!adding ? (
        <button onClick={() => setAdding(true)} className="btn-primary mb-3">
          <Plus className="w-4 h-4" /> Ajouter un employé
        </button>
      ) : (
        <EmployeeForm
          prefill={{
            candidateId: prefillCandidateId,
            userId: prefillUserId,
            firstName: prefillFirstName,
            lastName: prefillLastName
          }}
          onDone={closeAdd} onCancel={closeAdd}
        />
      )}

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="text-right">Brut / mois</th>
              <th className="text-right" title="Net cash sur le compte">Net cash</th>
              <th className="text-right" title="Net cash + chèques-repas + éco-chèques + frais représentation">Net en main</th>
              <th className="text-right">Précompte</th>
              <th className="text-right">ONSS</th>
              <th className="text-right" title="TCO voiture mensuel (non inclus dans cashflow payroll)">Voiture</th>
              <th className="text-right" title="Coût total employeur = brut + ONSS patronal + voiture + chèques + hospi + GSM + frais représentation">Coût total / mois</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-midnight-500 py-6">
                  Aucun employé enregistré. Utilise « Ajouter » ci-dessus.
                </td>
              </tr>
            )}
            {employees.map((e) => editingId === e.id ? (
              <tr key={e.id}>
                <td colSpan={9} className="p-0">
                  <EmployeeForm employee={e} availableConsultants={availableConsultants} onDone={() => setEditingId(null)} onCancel={() => setEditingId(null)} />
                </td>
              </tr>
            ) : (
              <Row key={e.id} e={e} onEdit={() => setEditingId(e.id)} />
            ))}
          </tbody>
        </table>
        <div className="p-3 text-[11px] text-midnight-500 border-t border-border/60">
          Valeurs <span className="font-mono text-indigoaccent">en italique</span> = calculées depuis le brut via barème I belge (isolé, 0 enfant). Les valeurs manuelles stockées remplacent le calcul si saisies.
        </div>
      </div>
    </>
  );
}

type RowProps = { e: Employee; onEdit: () => void };
function Row({ e, onEdit }: RowProps) {
  const [pending, start] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const isGone = e.endDate && new Date(e.endDate) < new Date();

  // Si le brut manque, on ignore les valeurs manuelles orphelines (bruits de
  // l'ancien schéma). Sinon la ligne affiche "net 2200 € mais brut —" qui n'a
  // aucun sens cohérent.
  const hasGross = (e.effectiveGross ?? 0) > 0;
  const calc = e.payrollCalc;
  const showNetCash   = hasGross ? (e.monthlyNetPay          > 0 ? e.monthlyNetPay          : (calc?.net ?? null)) : null;
  const showWht       = hasGross ? (e.monthlyWithholdingTax  > 0 ? e.monthlyWithholdingTax  : (calc?.withholdingTax ?? null)) : null;
  const showOnss      = hasGross ? (e.monthlyOnss            > 0 ? e.monthlyOnss            : (calc?.onssEmployee ?? null)) : null;
  const isNetAuto     = hasGross && !(e.monthlyNetPay > 0)         && showNetCash != null;
  const isWhtAuto     = hasGross && !(e.monthlyWithholdingTax > 0) && showWht     != null;
  const isOnssAuto    = hasGross && !(e.monthlyOnss > 0)           && showOnss    != null;

  // Net en main = net cash + perks (ou juste net cash si pas de package)
  const showNetInHand = e.packageDetail?.netTotalInHand ?? showNetCash;

  // Coût employeur :
  //  - avec package complet → totalEmployerCost (brut + ONSS patronal + voiture + perks)
  //  - sinon fallback mathématique : net + précompte + ONSS total = brut + ONSS patronal
  //    (identité comptable, ONSS stocké étant déjà la somme employé + patronal)
  const employerCost = e.payrollCalc?.totalEmployerCost
                     ?? ((showNetCash ?? 0) + (showWht ?? 0) + (showOnss ?? 0));

  function Cell({ value, auto }: { value: number | null; auto: boolean }) {
    if (value == null) return <span className="text-midnight-400">—</span>;
    return (
      <span className={auto ? "italic text-indigoaccent" : ""} title={auto ? "Calculé auto depuis le brut (barème I belge)" : "Valeur manuelle"}>
        {formatCurrency(value)}
      </span>
    );
  }

  return (
    <>
    <tr className={isGone ? "opacity-50" : ""}>
      <td>
        <div className="font-medium">{e.firstName} {e.lastName}</div>
        {e.sourceLink && (
          <Link href={e.sourceLink.href} className="text-[10px] text-indigoaccent hover:underline inline-flex items-center gap-1">
            <UserIcon className="w-2.5 h-2.5" /> {e.sourceLink.label}
          </Link>
        )}
        <div className="text-[10px] text-midnight-500">
          {formatDate(e.startDate)}
          {e.endDate ? ` → ${formatDate(e.endDate)}` : <span className="text-emerald-700"> · en poste</span>}
        </div>
        {e.notes && <div className="text-xs text-midnight-500 truncate max-w-[200px]">{e.notes}</div>}
      </td>
      <td className="text-right tabular-nums">
        {e.effectiveGross != null && e.effectiveGross > 0 ? (
          <span className={e.monthlyGrossReference == null ? "italic text-indigoaccent" : ""} title={e.monthlyGrossReference == null ? "Depuis la fiche consultant (onglet Rémunération)" : "Brut saisi manuellement"}>
            {formatCurrency(e.effectiveGross)}
          </span>
        ) : (
          <span className="text-amber-600 text-xs">
            {e.sourceLink?.href?.startsWith("/consultants/") ? (
              <Link href={`${e.sourceLink.href}?tab=compensation`} className="hover:underline" title="Créer un scénario de package sur la fiche consultant">
                Configurer ↗
              </Link>
            ) : (
              <button type="button" onClick={onEdit} className="hover:underline" title="Saisir le brut directement dans la fiche employé">
                Configurer ✎
              </button>
            )}
          </span>
        )}
      </td>
      <td className="text-right tabular-nums"><Cell value={showNetCash} auto={isNetAuto} /></td>
      <td className="text-right tabular-nums">
        {showNetInHand != null && e.packageDetail ? (
          <button onClick={() => setExpanded(!expanded)} className="text-indigoaccent hover:underline font-medium" title="Clic pour voir le détail package">
            {formatCurrency(showNetInHand)}
          </button>
        ) : showNetInHand != null ? (
          <span>{formatCurrency(showNetInHand)}</span>
        ) : <span className="text-midnight-400">—</span>}
      </td>
      <td className="text-right tabular-nums"><Cell value={showWht}  auto={isWhtAuto}  /></td>
      <td className="text-right tabular-nums"><Cell value={showOnss} auto={isOnssAuto} /></td>
      <td className="text-right tabular-nums">
        {e.carMonthlyTco && e.carMonthlyTco > 0 ? (
          <span
            className={e.carFromFleet ? "italic text-indigoaccent" : ""}
            title={e.carFromFleet
              ? `Leasing fleet · ${e.carFromFleet.plate} · ${e.carFromFleet.brand} ${e.carFromFleet.model}`
              : "Montant saisi manuellement"}
          >
            {formatCurrency(e.carMonthlyTco)}
          </span>
        ) : <span className="text-midnight-300">—</span>}
      </td>
      <td className="text-right tabular-nums font-semibold">{hasGross ? formatCurrency(employerCost) : "—"}</td>
      <td className="text-right">
        <div className="flex gap-1 justify-end">
          <button onClick={onEdit} className="text-midnight-500 hover:text-midnight-900">
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (!confirm(`Supprimer ${e.firstName} ${e.lastName} ?`)) return;
              start(async () => {
                try { await deleteEmployee(e.id); toast.success("Supprimé"); }
                catch (e: any) { toast.error(e?.message ?? "Erreur"); }
              });
            }}
            className="text-midnight-500 hover:text-red-600"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
    {expanded && e.packageDetail && (
      <tr className="bg-indigoaccent/5">
        <td colSpan={10} className="p-4">
          <div className="text-[10px] uppercase tracking-wide text-indigoaccent font-semibold mb-2">Décomposition du package — valeur mensuelle</div>
          <div className="grid grid-cols-4 gap-x-6 gap-y-2 text-xs">
            <KVLine lbl="Net cash sur le compte" val={e.packageDetail.netCash} />
            <KVLine lbl="Chèques-repas (part employeur nette)" val={e.packageDetail.mealVouchersNetMonthly} />
            <KVLine lbl="Éco-chèques (mensualisés)" val={e.packageDetail.ecoVouchersNetMonthly} />
            <KVLine lbl="Frais de représentation" val={e.packageDetail.netExpensesMonthly} />
            <KVLine lbl="ATN voiture (imposable)" val={e.packageDetail.atnCar} muted />
            <KVLine lbl="ATN GSM / internet" val={e.packageDetail.atnPhone} muted />
            <KVLine lbl="ATN hospi + assurances" val={e.packageDetail.atnHospital} muted />
            <KVLine lbl="VALEUR PACKAGE TOTALE" val={e.packageDetail.packageValueMonthly} bold />
          </div>
          <div className="text-[10px] text-midnight-500 mt-3">
            ATN = Avantage de Toute Nature. Ces montants ne sortent pas en cash, ils augmentent la base imposable pour le précompte. La voiture elle-même et l'hospi sont fournies en nature, donc valorisées dans la ligne « valeur package totale ».
          </div>
        </td>
      </tr>
    )}
    </>
  );
}

function KVLine({ lbl, val, bold, muted }: { lbl: string; val: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className={muted ? "text-midnight-400" : "text-midnight-600"}>{lbl}</span>
      <span className={"tabular-nums font-mono " + (bold ? "font-bold text-indigoaccent" : muted ? "text-midnight-500" : "text-midnight-900")}>
        {new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val)}
      </span>
    </div>
  );
}

function EmployeeForm({
  employee, prefill, availableConsultants = [], onDone, onCancel
}: {
  employee?: Employee;
  prefill?: {
    candidateId: string | null;
    userId: string | null;
    firstName: string;
    lastName: string;
  };
  availableConsultants?: ConsultantChoice[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        if (employee) await updateEmployee(employee.id, fd);
        else await createEmployee(fd);
        toast.success(employee ? "Modifié" : "Ajouté");
        onDone();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  const firstName = employee?.firstName ?? prefill?.firstName ?? "";
  const lastName  = employee?.lastName  ?? prefill?.lastName  ?? "";
  return (
    <form id="configure" onSubmit={submit} className="card p-4 border-2 border-indigoaccent mb-3 space-y-3">
      <h3 className="font-semibold">
        {employee ? "Modifier l'employé"
                  : prefill?.candidateId ? "Configurer la paie du candidat"
                  : prefill?.userId ? "Configurer la paie du consultant"
                  : "Nouvel employé"}
      </h3>
      {/* Liens source cachés — l'utilisateur ne les touche pas */}
      {prefill?.candidateId && <input type="hidden" name="candidateId" value={prefill.candidateId} />}
      {prefill?.userId && <input type="hidden" name="userId" value={prefill.userId} />}

      {/* En édition : permet de lier (ou re-lier) cette ligne payroll à un consultant existant.
          Essentiel pour que le brut remonte depuis l'onglet Rémunération. */}
      {employee && !employee.candidateId && (
        <div>
          <label className="label">Lier à un consultant (pour récupérer le brut depuis la fiche)</label>
          <select name="userId" defaultValue={employee.userId ?? ""} className="input max-w-md">
            <option value="">— Aucun lien (standalone) —</option>
            {availableConsultants.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.email})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-midnight-500 mt-1">
            Lie cette ligne de paie à un consultant actif. Son brut mensuel du simulateur de package sera utilisé automatiquement.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Prénom *</label>
          <input name="firstName" required defaultValue={firstName} className="input" />
        </div>
        <div>
          <label className="label">Nom *</label>
          <input name="lastName" required defaultValue={lastName} className="input" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label">Date d'entrée *</label>
          <input type="date" name="startDate" required defaultValue={employee?.startDate ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Date de sortie (facultatif)</label>
          <input type="date" name="endDate" defaultValue={employee?.endDate ?? ""} className="input" />
        </div>
      </div>

      <PayrollSection employee={employee} />

      <PackageSection employee={employee} />

      <div>
        <label className="label">Mois versés / an</label>
        <input type="number" step="0.01" name="monthsPerYear" defaultValue={employee?.monthsPerYear ?? 13.92} className="input max-w-[180px]" />
      </div>

      <textarea name="notes" rows={2} defaultValue={employee?.notes ?? ""} className="input" placeholder="Notes (voiture, avantages...)" />

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          <X className="w-4 h-4" /> Annuler
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {employee ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

/**
 * Section paie : saisie du brut → calcul auto net / précompte / ONSS en live.
 * Les 3 champs manuels sont optionnels ; s'ils sont vides, l'ERP utilise le
 * calcul auto depuis le brut (barème I belge).
 */
function PayrollSection({ employee }: { employee?: Employee }) {
  const [gross, setGross] = useState<number>(() => employee?.monthlyGrossReference ?? employee?.effectiveGross ?? 0);
  const [netOverride, setNetOverride] = useState<string>(() => employee?.monthlyNetPay ? String(employee.monthlyNetPay) : "");
  const [whtOverride, setWhtOverride] = useState<string>(() => employee?.monthlyWithholdingTax ? String(employee.monthlyWithholdingTax) : "");
  const [onssOverride, setOnssOverride] = useState<string>(() => employee?.monthlyOnss ? String(employee.monthlyOnss) : "");

  const calc = useMemo(() => (gross > 0 ? computeBelgianPayroll(gross) : null), [gross]);

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Salaire brut / mois (€) *</label>
        <input
          type="number" step="0.01" name="monthlyGrossReference" required
          value={gross || ""}
          onChange={(e) => setGross(parseFloat(e.target.value) || 0)}
          className="input max-w-[200px]"
          placeholder="ex: 4200"
        />
        <p className="text-[11px] text-midnight-500 mt-1">
          Si une fiche candidat liée existe, le brut est pré-rempli depuis le dernier scénario de package.
        </p>
      </div>

      {calc && (
        <div className="rounded-md border border-indigoaccent/30 bg-indigoaccent/5 p-3">
          <div className="flex items-center gap-2 text-xs text-indigoaccent font-semibold mb-2">
            <Sparkles className="w-3 h-3" /> CALCUL AUTO · Barème I belge (isolé, 0 enfant)
          </div>
          <div className="grid grid-cols-4 gap-3 text-sm">
            <KV lbl="ONSS total (employé + patronal)" val={formatCurrency(calc.onssEmployee + calc.onssEmployerEstimate)} />
            <KV lbl="Précompte prof." val={formatCurrency(calc.withholdingTax)} />
            <KV lbl="Net" val={formatCurrency(calc.net)} highlight />
            <KV lbl="Coût employeur" val={formatCurrency(calc.totalEmployerCost)} />
          </div>
          <div className="mt-2 text-[10px] text-midnight-500">
            Détail ONSS → employé 13,07 % · patronal ~25 % · total {formatCurrency(calc.onssEmployee + calc.onssEmployerEstimate)}
          </div>
          <p className="text-[11px] text-midnight-500 mt-2">
            Ces valeurs sont utilisées automatiquement si tu laisses les champs manuels ci-dessous vides.
          </p>
        </div>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-midnight-500 uppercase tracking-wide">Override manuels (facultatif)</summary>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div>
            <label className="label">Net manuel</label>
            <input type="number" step="0.01" name="monthlyNetPay" value={netOverride} onChange={(e) => setNetOverride(e.target.value)} className="input" placeholder={calc ? String(calc.net) : "—"} />
          </div>
          <div>
            <label className="label">Précompte manuel</label>
            <input type="number" step="0.01" name="monthlyWithholdingTax" value={whtOverride} onChange={(e) => setWhtOverride(e.target.value)} className="input" placeholder={calc ? String(calc.withholdingTax) : "—"} />
          </div>
          <div>
            <label className="label">ONSS manuel</label>
            <input type="number" step="0.01" name="monthlyOnss" value={onssOverride} onChange={(e) => setOnssOverride(e.target.value)} className="input" placeholder={calc ? String(calc.onssEmployee) : "—"} />
          </div>
        </div>
      </details>
    </div>
  );
}

/**
 * Section package / avantages : voiture, chèques-repas, éco-chèques, hospi,
 * GSM/internet, frais de représentation. Ces montants viennent surcharger
 * le scénario candidat si saisis ici.
 */
function PackageSection({ employee }: { employee?: Employee }) {
  return (
    <details className="rounded-md border border-border bg-midnight-50/30 p-3">
      <summary className="cursor-pointer text-xs text-indigoaccent uppercase tracking-wide font-semibold">
        Package / avantages (voiture, chèques, frais de représ…)
      </summary>
      <p className="text-[11px] text-midnight-500 mt-2 mb-3">
        Ces montants viennent s'ajouter au calcul (ATN voiture, chèques-repas nets, éco-chèques, hospitalisation, GSM/internet, frais de représentation). Si une fiche candidat liée a déjà un scénario, les valeurs saisies ici le remplacent.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <PkgField label="Voiture (TCO / mois)"      name="carMonthlyTco"             initial={employee?.carMonthlyTco} />
        <PkgField label="Chèques-repas / jour"      name="mealVoucherEmployerPerDay" initial={employee?.mealVoucherEmployerPerDay} />
        <PkgField label="Éco-chèques / an"          name="ecoVouchersAnnual"         initial={employee?.ecoVouchersAnnual} />
        <PkgField label="Hospitalisation / mois"    name="hospitalInsuranceMonthly"  initial={employee?.hospitalInsuranceMonthly} />
        <PkgField label="GSM + internet / mois"     name="phoneInternetMonthly"      initial={employee?.phoneInternetMonthly} />
        <PkgField label="Frais représentation / mois" name="netExpensesMonthly"      initial={employee?.netExpensesMonthly} />
      </div>
    </details>
  );
}

function PkgField({ label, name, initial }: { label: string; name: string; initial?: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" step="0.01" name={name} defaultValue={initial || ""} className="input" placeholder="0" />
    </div>
  );
}

function KV({ lbl, val, highlight }: { lbl: string; val: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-midnight-500">{lbl}</div>
      <div className={"font-mono tabular-nums text-sm " + (highlight ? "text-indigoaccent font-semibold" : "text-midnight-900")}>{val}</div>
    </div>
  );
}
