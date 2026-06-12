import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { computeVatReport, getQuarter, periodForQuarter, type Quarter } from "@/lib/tva";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";

export default async function TvaTrimestriellePage({
  searchParams
}: {
  searchParams: { year?: string; quarter?: string };
}) {
  await requirePermissionOrRedirect("finance.read");

  // Par défaut : trimestre précédent (le délai de déclaration est le 20 du mois suivant)
  const now = new Date();
  let defaultYear = now.getUTCFullYear();
  let defaultQuarter = getQuarter(now);
  // Si on est sur les 20 premiers jours d'un mois suivant un trimestre,
  // on pointe encore vers le trimestre précédent.
  if (defaultQuarter === 1 && now.getUTCMonth() === 0) {
    defaultYear -= 1;
    defaultQuarter = 4;
  } else {
    // décale d'un trimestre par défaut
    defaultQuarter = (defaultQuarter === 1 ? 4 : ((defaultQuarter - 1) as Quarter));
    if (defaultQuarter === 4 && now.getUTCMonth() < 3) defaultYear -= 1;
  }

  const year = Number(searchParams.year ?? defaultYear);
  const quarter = (Number(searchParams.quarter ?? defaultQuarter) as Quarter);
  const period = periodForQuarter(year, quarter);

  const report = await computeVatReport(year, quarter);

  // Construire la liste des trimestres (3 ans en arrière)
  const currentY = now.getUTCFullYear();
  const years = [currentY + 1, currentY, currentY - 1, currentY - 2];

  return (
    <div>
      <PageHeader
        title="Déclaration TVA trimestrielle"
        subtitle={
          <span>
            Période : {formatDate(period.startDate)} → {formatDate(period.endDate)}
            <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
              Vision prévisionnelle — inclut PLANNED / READY / TRANSMITTED / PAID
            </span>
          </span>
        }
      />

      <form className="mb-6 flex flex-wrap gap-2 items-end">
        <div>
          <label className="label">Année</label>
          <select name="year" defaultValue={year} className="input">
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Trimestre</label>
          <select name="quarter" defaultValue={quarter} className="input">
            <option value={1}>T1 (Jan-Mar)</option>
            <option value={2}>T2 (Avr-Jun)</option>
            <option value={3}>T3 (Jul-Sep)</option>
            <option value={4}>T4 (Oct-Déc)</option>
          </select>
        </div>
        <button className="btn-primary">Recalculer</button>
      </form>

      {/* Synthèse — 5 KPIs : on distingue TVA achats brute (info) vs effectivement
          déductible (la seule qui compte pour case 59 et la grille). */}
      <div className="grid md:grid-cols-5 gap-3 mb-6">
        <Kpi
          label="Ventes HTVA"
          value={formatCurrency(report.totalSalesHt)}
          sub={`${report.salesLines.length} ligne(s)`}
          tone="ok"
        />
        <Kpi
          label="TVA collectée"
          value={formatCurrency(report.totalSalesVat)}
          sub="à reverser à l'État"
          tone="warn"
        />
        <Kpi
          label="Achats HTVA"
          value={formatCurrency(report.totalPurchasesHt)}
          sub={`${report.purchasesLines.length} ligne(s) — 3 sources`}
        />
        <Kpi
          label="TVA déductible"
          value={formatCurrency(report.totalDeductibleVat)}
          sub={`sur ${formatCurrency(report.totalPurchasesVat)} brut`}
          tone="ok"
        />
        <Kpi
          label={report.netDueOrCredit >= 0 ? "À payer (case 71)" : "Crédit (case 72)"}
          value={formatCurrency(Math.abs(report.netDueOrCredit))}
          sub={
            report.netDueOrCredit >= 0
              ? "Paiement au 20 du mois suivant"
              : "Reporté ou remboursé"
          }
          tone={report.netDueOrCredit >= 0 ? "danger" : "ok"}
        />
      </div>

      {/* Grille TVA */}
      <div className="card mb-6">
        <div className="card-header flex items-center justify-between">
          <div>
            <div className="font-semibold">Grille à recopier dans Intervat</div>
            <div className="text-xs text-midnight-500 mt-0.5">
              Vue simplifiée — les cases à 0 sont masquées
            </div>
          </div>
        </div>
        <div className="p-4 grid md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
          <GridSection title="Opérations à la sortie (ventes)">
            <GridRow code="01" label="HTVA à 6%" value={report.grid.case01} />
            <GridRow code="02" label="HTVA à 12%" value={report.grid.case02} />
            <GridRow code="03" label="HTVA à 21%" value={report.grid.case03} highlight />
            <GridRow code="47" label="Exonérations" value={report.grid.case47} />
            <GridRow code="54" label="TVA due sur opérations" value={report.grid.case54} highlight />
          </GridSection>
          <GridSection title="Opérations à l'entrée (achats)">
            <GridRow code="81" label="Biens & services HTVA (marchandises, fournitures)" value={report.grid.case81} highlight />
            <GridRow code="82" label="Services divers HTVA (SaaS, sous-traitance, télécom…)" value={report.grid.case82} highlight />
            <GridRow code="83" label="Biens d'investissement HTVA (laptop, voiture)" value={report.grid.case83} highlight />
            <GridRow code="59" label="TVA déductible (après règles 50 % voiture, 0 % restau, etc.)" value={report.grid.case59} highlight />
          </GridSection>
          <GridSection title="Soldes" full>
            <GridRow
              code="71"
              label="Solde à payer à l'État"
              value={report.grid.case71}
              highlight
            />
            <GridRow
              code="72"
              label="Solde à récupérer / reporter"
              value={report.grid.case72}
              highlight
            />
          </GridSection>
        </div>
        <div className="px-4 pb-4 flex gap-2">
          <CopyButton
            text={[
              `Déclaration TVA — ${year} T${quarter}`,
              `Période : ${formatDate(period.startDate)} → ${formatDate(period.endDate)}`,
              "",
              `Case 03 : ${report.grid.case03.toFixed(2)} €  (HTVA 21%)`,
              `Case 54 : ${report.grid.case54.toFixed(2)} €  (TVA due)`,
              `Case 81 : ${report.grid.case81.toFixed(2)} €  (Biens & services HTVA)`,
              `Case 82 : ${report.grid.case82.toFixed(2)} €  (Services divers HTVA)`,
              `Case 83 : ${report.grid.case83.toFixed(2)} €  (Investissements HTVA)`,
              `Case 59 : ${report.grid.case59.toFixed(2)} €  (TVA déductible effective)`,
              `Case 71 : ${report.grid.case71.toFixed(2)} €  (à payer)`,
              `Case 72 : ${report.grid.case72.toFixed(2)} €  (à récupérer)`
            ].join("\n")}
          />
          <Link
            href={`/test/tva/export?year=${year}&quarter=${quarter}`}
            className="btn-secondary text-sm"
          >
            Export CSV (détail)
          </Link>
        </div>
      </div>

      {/* Détail des ventes */}
      <div className="card mb-6">
        <div className="card-header">
          <div className="font-semibold">Ventes du trimestre ({report.salesLines.length})</div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Statut</th>
                <th>Client</th>
                <th>Libellé</th>
                <th className="text-right">HTVA</th>
                <th className="text-right">TVA</th>
                <th className="text-right">Taux</th>
              </tr>
            </thead>
            <tbody>
              {report.salesLines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-midnight-400 py-6">
                    Aucune vente sur cette période.
                  </td>
                </tr>
              ) : (
                report.salesLines.map((l) => (
                  <tr key={l.id}>
                    <td className="text-xs whitespace-nowrap">{formatDate(l.date)}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td>{l.company ?? "—"}</td>
                    <td className="text-sm">{l.label}</td>
                    <td className="text-right tabular-nums">{formatCurrency(l.amountHt)}</td>
                    <td className="text-right tabular-nums">{formatCurrency(l.vatAmount)}</td>
                    <td className="text-right text-xs">{l.vatRate}%</td>
                  </tr>
                ))
              )}
            </tbody>
            {report.salesLines.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-midnight-50">
                  <td colSpan={4} className="text-right">
                    Total
                  </td>
                  <td className="text-right tabular-nums">
                    {formatCurrency(report.totalSalesHt)}
                  </td>
                  <td className="text-right tabular-nums">
                    {formatCurrency(report.totalSalesVat)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Détail des achats — 3 sources cumulées : Purchase (achats projet) +
          SupplierInvoice (factures fournisseurs drag-drop) + ExpenseReport
          (notes de frais consultants APPROVED/PAID). Colonnes ajoutées :
          Source, Catégorie, Déduction (= colonne qui dit pourquoi un restau
          déduit 0 % et une voiture 50 %), TVA effective (= ce qui entre case 59). */}
      <div className="card">
        <div className="card-header">
          <div className="font-semibold">Achats du trimestre ({report.purchasesLines.length})</div>
          <div className="text-xs text-midnight-500 mt-0.5">
            Cumul Purchase + Factures fournisseurs (PENDING/PAID) + Notes de frais (APPROVED/PAID).
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Catégorie</th>
                <th>Fournisseur</th>
                <th>Libellé</th>
                <th className="text-right">Case</th>
                <th className="text-right">HTVA</th>
                <th className="text-right">TVA</th>
                <th className="text-right">Déd.</th>
                <th className="text-right">TVA déductible</th>
              </tr>
            </thead>
            <tbody>
              {report.purchasesLines.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-midnight-400 py-6">
                    Aucun achat enregistré sur cette période.
                  </td>
                </tr>
              ) : (
                report.purchasesLines.map((l) => (
                  <tr key={`${l.source}-${l.id}`}>
                    <td className="text-xs whitespace-nowrap">{formatDate(l.date)}</td>
                    <td><SourceBadge source={l.source} /></td>
                    <td className="text-[11px] text-midnight-600 whitespace-nowrap">{l.category ?? "—"}</td>
                    <td>{l.company ?? "—"}</td>
                    <td className="text-sm">{l.label}</td>
                    <td className="text-right">
                      <span className="font-mono text-[10px] bg-midnight-100 text-midnight-700 rounded px-1.5 py-0.5">
                        {l.vatBox}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{formatCurrency(l.amountHt)}</td>
                    <td className="text-right tabular-nums text-midnight-500">{formatCurrency(l.vatAmount)}</td>
                    <td className={`text-right text-xs ${l.deductibleRate < 1 ? "text-amber-700 font-medium" : "text-midnight-500"}`}>
                      {Math.round(l.deductibleRate * 100)}%
                    </td>
                    <td className="text-right tabular-nums font-medium">{formatCurrency(l.deductibleVat)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {report.purchasesLines.length > 0 && (
              <tfoot>
                <tr className="font-semibold bg-midnight-50">
                  <td colSpan={6} className="text-right">Total</td>
                  <td className="text-right tabular-nums">{formatCurrency(report.totalPurchasesHt)}</td>
                  <td className="text-right tabular-nums text-midnight-500">{formatCurrency(report.totalPurchasesVat)}</td>
                  <td />
                  <td className="text-right tabular-nums">{formatCurrency(report.totalDeductibleVat)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="mt-6 text-[11px] text-midnight-400 space-y-1">
        <div>
          ⚠️ <b>Vue prévisionnelle</b> — côté ventes : inclut toutes les BillingMilestones non annulées
          (PLANNED + READY + INVOICED + TRANSMITTED + PAID). Côté achats : Purchase non annulés + factures
          fournisseurs (PENDING / PAID) + notes de frais (APPROVED / PAID). Pour la déclaration officielle
          Intervat, restreins aux statuts émis (TRANSMITTED / PAID).
        </div>
        <div>
          💡 <b>Déduction TVA</b> appliquée selon la catégorie de chaque ligne (lib/belgian-vat-rules.ts) :
          50 % pour voitures (achat, leasing, carburant, entretien, assurance) — 0 % pour restaurants, hôtels,
          frais de représentation et gros cadeaux — 100 % pour le reste. Override possible par ligne.
          Ne couvre pas : cocontractant (case 55/87), acquisitions intracomm. (case 56/86), importations (57),
          notes de crédit (48/85).
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-red-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-midnight-900";
  return (
    <div className="card p-4">
      <div className="text-xs text-midnight-500">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-midnight-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function GridSection({
  title,
  children,
  full
}: {
  title: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-midnight-400 font-semibold mb-1 mt-2">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    milestone:        { label: "Vente",          cls: "bg-emerald-100 text-emerald-700" },
    purchase:         { label: "Achat projet",   cls: "bg-blue-100 text-blue-700" },
    supplier_invoice: { label: "Facture fourn.", cls: "bg-violet-100 text-violet-700" },
    expense_report:   { label: "Note de frais",  cls: "bg-rose-100 text-rose-700" }
  };
  const c = map[source] ?? { label: source, cls: "bg-midnight-100 text-midnight-700" };
  return (
    <span className={`text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap ${c.cls}`}>
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    // Milestones
    PLANNED: { label: "Prévu", cls: "bg-midnight-100 text-midnight-700" },
    READY: { label: "À facturer", cls: "bg-amber-100 text-amber-700" },
    TRANSMITTED: { label: "Émis", cls: "bg-blue-100 text-blue-700" },
    PAID: { label: "Payé", cls: "bg-emerald-100 text-emerald-700" },
    // Purchases
    ORDERED: { label: "Commandé", cls: "bg-amber-100 text-amber-700" },
    RECEIVED: { label: "Reçu", cls: "bg-blue-100 text-blue-700" }
  };
  const c = map[status] ?? { label: status, cls: "bg-midnight-100 text-midnight-700" };
  return (
    <span className={`text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap ${c.cls}`}>
      {c.label}
    </span>
  );
}

function GridRow({
  code,
  label,
  value,
  highlight
}: {
  code: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  if (value === 0 && !highlight) return null;
  return (
    <div
      className={`flex items-center justify-between text-sm py-1 ${
        highlight ? "font-medium" : "text-midnight-700"
      }`}
    >
      <span>
        <span className="font-mono text-[10px] bg-midnight-100 text-midnight-700 rounded px-1.5 py-0.5 mr-2">
          {code}
        </span>
        {label}
      </span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
