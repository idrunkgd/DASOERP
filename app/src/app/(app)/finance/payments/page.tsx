import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { FilterChips } from "@/components/ui/filter-chips";
import { FilterMultiSelect } from "@/components/ui/filter-multi-select";
import { PreservedSearchForm } from "@/components/ui/preserved-search-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseMulti } from "@/lib/filters";

export const dynamic = "force-dynamic";

/**
 * Historique complet des paiements.
 *
 * But : rassembler en un seul écran TOUS les paiements/encaissements passés,
 * même ceux dont la ligne source est aujourd'hui masquée dans /cashflow
 * (une ligne y est cachée dès qu'il n'y a plus de flux futur — utile pour
 * garder la vue prévisionnelle propre, mais handicapant pour retrouver un
 * paiement passé).
 *
 * Trois sources sont agrégées :
 *   - Revenus clients      → BillingMilestone status=PAID
 *   - Charges récurrentes  → RecurringExpenseMonth status=PAID
 *   - Charges ponctuelles  → OneOffCashflowEntry status=PAID
 *
 * Filtres : type (revenus / charges / tous), période (from/to sur la date
 * de paiement), client. Tri : date de paiement décroissante.
 */
export default async function PaymentsHistoryPage({
  searchParams
}: {
  searchParams: {
    type?: string; // "income" | "expense" | ""
    from?: string;
    to?: string;
    companyId?: string;
  };
}) {
  await requirePermission("finance.read");

  const type = searchParams.type ?? "";
  const companyIds = parseMulti(searchParams.companyId);
  const fromDate = searchParams.from ? new Date(searchParams.from) : null;
  const toDate = searchParams.to ? new Date(searchParams.to) : null;

  // ─── 1) Revenus : BillingMilestone PAID ───
  const milestones = type === "expense" ? [] : await prisma.billingMilestone.findMany({
    where: {
      status: "PAID",
      ...(fromDate || toDate ? {
        paidAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {})
        }
      } : {})
    },
    include: {
      offer: { include: { company: true } },
      project: { include: { company: true } },
      company: true
    },
    orderBy: { paidAt: "desc" }
  });

  const milestoneRows = milestones
    .filter(m => {
      if (companyIds.length === 0) return true;
      const cid = m.offer?.companyId ?? m.project?.companyId ?? m.companyId;
      return cid ? companyIds.includes(cid) : false;
    })
    .map(m => {
      const company = m.offer?.company ?? m.project?.company ?? m.company;
      const source = m.offer
        ? { kind: "Offre", ref: m.offer.reference, href: `/offers/${m.offer.id}` }
        : m.project
        ? { kind: "Projet", ref: m.project.reference, href: `/projects/${m.project.id}` }
        : { kind: "—", ref: "—", href: "" };
      return {
        id: `ms-${m.id}`,
        kind: "income" as const,
        date: m.paidAt,
        label: m.label,
        counterparty: company?.name ?? "—",
        counterpartyHref: company ? `/companies/${company.id}` : "",
        source,
        amount: Number(m.amount),
        note: m.trigger ?? undefined
      };
    });

  // ─── 2) Charges récurrentes payées ───
  const recurringMonths = type === "income" ? [] : await prisma.recurringExpenseMonth.findMany({
    where: {
      status: "PAID",
      ...(fromDate || toDate ? {
        paidAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {})
        }
      } : {})
    },
    include: { recurringExpense: true },
    orderBy: { paidAt: "desc" }
  });
  const recurringRows = recurringMonths.map(rm => ({
    id: `rec-${rm.id}`,
    kind: "expense" as const,
    date: rm.paidAt,
    label: `${rm.recurringExpense.label} — ${String(rm.month).padStart(2, "0")}/${rm.year}`,
    counterparty: rm.recurringExpense.category ?? "Récurrent",
    counterpartyHref: "",
    source: { kind: "Récurrent", ref: rm.recurringExpense.label, href: "" },
    amount: Number(rm.amountOverride ?? rm.recurringExpense.defaultAmount),
    note: undefined
  }));

  // ─── 3) Charges ponctuelles payées ───
  const oneOffs = type === "income" ? [] : await prisma.oneOffCashflowEntry.findMany({
    where: {
      status: "PAID",
      ...(fromDate || toDate ? {
        paidAt: {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {})
        }
      } : {})
    },
    orderBy: { paidAt: "desc" }
  });
  const oneOffRows = oneOffs.map(o => ({
    id: `oo-${o.id}`,
    kind: "expense" as const,
    date: o.paidAt,
    label: o.label,
    counterparty: o.category ?? "Ponctuel",
    counterpartyHref: "",
    source: { kind: "Ponctuel", ref: o.label, href: "" },
    amount: Number(o.amount),
    note: undefined
  }));

  // Fusion + tri par date décroissante
  const allRows = [...milestoneRows, ...recurringRows, ...oneOffRows]
    .sort((a, b) => {
      const da = a.date?.getTime() ?? 0;
      const db = b.date?.getTime() ?? 0;
      return db - da;
    });

  const totalIncome = milestoneRows.reduce((s, r) => s + r.amount, 0);
  const totalExpense = recurringRows.reduce((s, r) => s + r.amount, 0) + oneOffRows.reduce((s, r) => s + r.amount, 0);
  const net = totalIncome - totalExpense;

  const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <PageHeader
        title="Historique des paiements"
        subtitle={`${allRows.length} paiement(s) enregistré(s) — inclus les lignes archivées`}
        actions={
          <Link href="/finance" className="btn-ghost text-sm">← Retour Facturations</Link>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Encaissé (revenus)" value={formatCurrency(totalIncome)} tone="success" />
        <KpiCard label="Payé (charges)" value={formatCurrency(totalExpense)} tone="warning" />
        <KpiCard label="Net" value={formatCurrency(net)} tone={net >= 0 ? "success" : "danger"} />
      </div>

      <div className="mb-4 space-y-3">
        <FilterChips
          paramName="type"
          label="Type"
          multi={false}
          options={[
            { value: "income",  label: "Revenus (encaissés)", tone: "success" },
            { value: "expense", label: "Charges (payées)",    tone: "warning" }
          ]}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-midnight-500 uppercase tracking-wide mr-1">Client</span>
          <FilterMultiSelect
            paramName="companyId"
            label="Client"
            options={companies.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Chercher un client…"
          />
        </div>
        <PreservedSearchForm
          searchParams={searchParams as Record<string, string | undefined>}
          except={["from", "to", "page"]}
          className="flex gap-2 flex-wrap items-center"
        >
          <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="input max-w-[160px] text-sm" />
          <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="input max-w-[160px] text-sm" />
          <button className="btn-secondary btn-sm">Appliquer dates</button>
        </PreservedSearchForm>
      </div>

      <div className="card overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Date</th>
              <th>Libellé</th>
              <th>Client / Fournisseur</th>
              <th>Source</th>
              <th className="text-right">Montant</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {allRows.length === 0 && (
              <tr><td colSpan={6} className="text-center text-midnight-400 italic py-6">Aucun paiement pour ces filtres.</td></tr>
            )}
            {allRows.map(r => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{r.date ? formatDate(r.date) : "—"}</td>
                <td className="font-medium">
                  {r.label}
                  {r.note && <div className="text-xs text-midnight-500">{r.note}</div>}
                </td>
                <td>
                  {r.counterpartyHref
                    ? <Link href={r.counterpartyHref} className="hover:underline">{r.counterparty}</Link>
                    : r.counterparty}
                </td>
                <td className="text-xs">
                  {r.source.href
                    ? <Link href={r.source.href} className="hover:underline">{r.source.kind} {r.source.ref}</Link>
                    : <span className="text-midnight-500">{r.source.kind}</span>}
                </td>
                <td className={`text-right tabular-nums font-medium ${r.kind === "income" ? "text-emerald-700" : "text-amber-700"}`}>
                  {r.kind === "income" ? "+" : "−"} {formatCurrency(r.amount)}
                </td>
                <td>
                  {r.kind === "income"
                    ? <span className="badge-success text-[10px]">Encaissé</span>
                    : <span className="badge-warning text-[10px]">Payé</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
