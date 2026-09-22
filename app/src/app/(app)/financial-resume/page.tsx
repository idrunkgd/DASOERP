/**
 * Résumé financier — page d'analyse avancée sous Pilotage.
 *
 * Contenu :
 * - KPIs annuels : CA total, CA par type (projet/consultance/libre), dépenses,
 *   marge, taux marge
 * - Répartition CA par type (barres visuelles)
 * - Dépenses par catégorie (top N + total)
 * - Top 15 grosses dépenses (SupplierInvoice + ExpenseReport combinés)
 * - Breakdown par personne : CA généré, coût interne, marge par consultant
 * - Filtre année (default = année courante)
 *
 * ACL : finance.read (Admin, Manager, Finance).
 */
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Activity, Wallet, PiggyBank, Users, Building2 } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const SUPPLIER_CATEGORY_LABEL: Record<string, string> = {
  CAR_PURCHASE: "Achat véhicule", CAR_LEASE: "Leasing véhicule", CAR_FUEL: "Carburant",
  CAR_MAINTENANCE: "Entretien véhicule", CAR_INSURANCE: "Assurance véhicule",
  RESTAURANT: "Restaurant", HOTEL: "Hôtel", OFFICE_RENT: "Loyer bureau",
  UTILITIES: "Charges (élec/gaz/eau)", SOFTWARE_SAAS: "Logiciels / SaaS",
  SUBCONTRACTING: "Sous-traitance", OFFICE_SUPPLIES: "Fournitures bureau",
  HARDWARE_SMALL: "Matériel (< 1000€)", HARDWARE_INVESTMENT: "Investissement matériel",
  PROFESSIONAL_SERVICES: "Services pro (compta, avocat)", TRAINING: "Formation",
  TELECOM: "Télécom", GIFT_LOW: "Cadeau (< 50€)", GIFT_HIGH: "Cadeau (> 50€)",
  REPRESENTATION: "Représentation", OTHER: "Autre"
};

const EXPENSE_CATEGORY_LABEL: Record<string, string> = {
  MEAL: "Restaurant", TRANSPORT: "Transport", ACCOMMODATION: "Hébergement",
  FUEL: "Carburant", PARKING: "Parking / péage", SOFTWARE: "Logiciel",
  TRAINING: "Formation", REPRESENTATION: "Représentation", OTHER: "Autre"
};

export default async function FinancialResumePage({ searchParams }: { searchParams: { year?: string } }) {
  await requirePermission("finance.read");

  const now = new Date();
  const year = searchParams.year ? parseInt(searchParams.year, 10) : now.getFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [
    milestones,
    supplierInvoices,
    expenseReports,
    users,
    timesheetEntries
  ] = await Promise.all([
    // Toutes les tranches de facturation non annulées attendues cette année
    prisma.billingMilestone.findMany({
      where: {
        status: { notIn: ["CANCELLED"] },
        expectedAt: { gte: yearStart, lt: yearEnd }
      },
      include: {
        project: { select: { id: true, name: true, reference: true, company: { select: { name: true } } } },
        mission: { select: { id: true, reference: true, title: true, company: { select: { name: true } }, consultant: { select: { firstName: true, lastName: true } } } },
        company: { select: { name: true } }
      }
    }),
    // Factures fournisseurs de l'année
    prisma.supplierInvoice.findMany({
      where: {
        invoiceDate: { gte: yearStart, lt: yearEnd },
        status: { notIn: ["CANCELLED"] }
      },
      orderBy: { amountTtc: "desc" }
    }),
    // Notes de frais approuvées / payées / soumises de l'année
    prisma.expenseReport.findMany({
      where: {
        date: { gte: yearStart, lt: yearEnd },
        status: { in: ["APPROVED", "PAID", "SUBMITTED"] }
      },
      include: {
        user: { select: { firstName: true, lastName: true } },
        mission: { select: { reference: true, title: true } },
        project: { select: { reference: true, name: true } },
        costCenter: { select: { code: true, name: true } }
      },
      orderBy: { amountTtc: "desc" }
    }),
    // Consultants avec leur coût horaire pour calculer coût interne
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, role: true, hourlyCost: true }
    }),
    // Timesheet entries validées de l'année (pour marge par consultant)
    prisma.timesheetEntry.findMany({
      where: {
        date: { gte: yearStart, lt: yearEnd },
        status: "APPROVED"
      },
      include: {
        mission: { select: { dailyRate: true } }
      }
    })
  ]);

  // ─── Agrégats CA ───
  let caTotal = 0, caProject = 0, caConsulting = 0, caStandalone = 0;
  for (const m of milestones) {
    const amount = Number(m.amount);
    caTotal += amount;
    if (m.missionId) caConsulting += amount;
    else if (m.projectId) caProject += amount;
    else caStandalone += amount;
  }

  // ─── Agrégats dépenses ───
  const supplierExpensesTotal = supplierInvoices.reduce((s, i) => s + Number(i.amountTtc), 0);
  const employeeExpensesTotal = expenseReports.reduce((s, e) => s + Number(e.amountTtc), 0);
  const totalExpenses = supplierExpensesTotal + employeeExpensesTotal;

  // Dépenses par catégorie (SupplierInvoice)
  const supplierByCat = new Map<string, { total: number; count: number }>();
  for (const inv of supplierInvoices) {
    const cat = inv.category as string;
    const cur = supplierByCat.get(cat) ?? { total: 0, count: 0 };
    cur.total += Number(inv.amountTtc);
    cur.count += 1;
    supplierByCat.set(cat, cur);
  }
  const supplierCategoriesSorted = Array.from(supplierByCat.entries())
    .map(([cat, v]) => ({ cat, label: SUPPLIER_CATEGORY_LABEL[cat] ?? cat, ...v }))
    .sort((a, b) => b.total - a.total);

  // Dépenses par catégorie (ExpenseReport)
  const employeeByCat = new Map<string, { total: number; count: number }>();
  for (const r of expenseReports) {
    const cat = r.category as string;
    const cur = employeeByCat.get(cat) ?? { total: 0, count: 0 };
    cur.total += Number(r.amountTtc);
    cur.count += 1;
    employeeByCat.set(cat, cur);
  }
  const employeeCategoriesSorted = Array.from(employeeByCat.entries())
    .map(([cat, v]) => ({ cat, label: EXPENSE_CATEGORY_LABEL[cat] ?? cat, ...v }))
    .sort((a, b) => b.total - a.total);

  // ─── Top 15 grosses dépenses (toutes sources confondues) ───
  type BigExpense = {
    kind: "SUPPLIER" | "REPORT";
    id: string;
    date: Date;
    label: string;
    supplier?: string;
    author?: string;
    category: string;
    amountTtc: number;
  };
  const bigExpenses: BigExpense[] = [
    ...supplierInvoices.map((i): BigExpense => ({
      kind: "SUPPLIER",
      id: i.id,
      date: i.invoiceDate,
      label: i.invoiceNumber ? `Facture ${i.invoiceNumber}` : `${i.supplierName}`,
      supplier: i.supplierName,
      category: SUPPLIER_CATEGORY_LABEL[i.category as string] ?? i.category,
      amountTtc: Number(i.amountTtc)
    })),
    ...expenseReports.map((r): BigExpense => ({
      kind: "REPORT",
      id: r.id,
      date: r.date,
      label: r.description || "(sans description)",
      author: `${r.user.firstName} ${r.user.lastName}`,
      category: EXPENSE_CATEGORY_LABEL[r.category as string] ?? r.category,
      amountTtc: Number(r.amountTtc)
    }))
  ].sort((a, b) => b.amountTtc - a.amountTtc).slice(0, 15);

  // ─── Breakdown par consultant ───
  const usersById = new Map(users.map((u) => [u.id, u]));
  const perPerson = new Map<string, { userId: string; name: string; role: string; hours: number; revenue: number; cost: number }>();
  for (const e of timesheetEntries) {
    const u = usersById.get(e.userId);
    if (!u) continue;
    const key = e.userId;
    const cur = perPerson.get(key) ?? {
      userId: e.userId,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      hours: 0, revenue: 0, cost: 0
    };
    const hours = Number(e.hours);
    cur.hours += hours;
    // Revenue : uniquement si sur mission (T&M) — hours × (dailyRate / 8)
    if (e.missionId && e.mission?.dailyRate) {
      cur.revenue += hours * (Number(e.mission.dailyRate) / 8);
    }
    // Coût interne : hours × hourlyCost user
    if (u.hourlyCost) {
      cur.cost += hours * Number(u.hourlyCost);
    }
    perPerson.set(key, cur);
  }
  const perPersonSorted = Array.from(perPerson.values())
    .map((p) => ({ ...p, margin: p.revenue - p.cost, marginPct: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  const totalPersonRevenue = perPersonSorted.reduce((s, p) => s + p.revenue, 0);
  const totalPersonCost = perPersonSorted.reduce((s, p) => s + p.cost, 0);

  // ─── Marge globale ───
  const marginRaw = caTotal - totalExpenses;
  const marginPct = caTotal > 0 ? (marginRaw / caTotal) * 100 : 0;

  // Sélection année
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <PageHeader
        title="Résumé financier"
        subtitle={`Analyse détaillée · ${year}`}
        actions={
          <div className="flex gap-1">
            {years.map((y) => (
              <Link
                key={y}
                href={`/financial-resume?year=${y}`}
                className={y === year ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
              >
                {y}
              </Link>
            ))}
          </div>
        }
      />

      {/* ─── KPIs principaux ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="CA total"
          value={formatCurrency(caTotal)}
          hint={`${milestones.length} tranche${milestones.length > 1 ? "s" : ""} · HTVA · non annulées`}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Dépenses totales"
          value={formatCurrency(totalExpenses)}
          hint={`${supplierInvoices.length} factures fourn. + ${expenseReports.length} notes de frais`}
          icon={TrendingDown}
          tone="danger"
        />
        <KpiCard
          label="Marge brute"
          value={formatCurrency(marginRaw)}
          hint={`${marginPct.toFixed(1)} % du CA`}
          icon={Activity}
          tone={marginRaw >= 0 ? "success" : "danger"}
        />
        <KpiCard
          label="Solde net YTD"
          value={formatCurrency(caTotal - totalExpenses)}
          hint="CA − dépenses (indicatif, HTVA)"
          icon={PiggyBank}
          tone={caTotal >= totalExpenses ? "success" : "danger"}
        />
      </div>

      {/* ─── Répartition CA ─── */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-mono uppercase tracking-widest text-midnight-500">Répartition du chiffre d'affaires</h2>
          <span className="text-xs text-midnight-500">Total : <strong className="text-midnight-900">{formatCurrency(caTotal)}</strong></span>
        </div>
        <div className="space-y-2">
          {[
            { label: "Consultance T&M (missions)", value: caConsulting, color: "bg-amber-500" },
            { label: "Projets forfait", value: caProject, color: "bg-indigoaccent" },
            { label: "Facturation libre / directe", value: caStandalone, color: "bg-slate-500" }
          ].filter((r) => r.value > 0).map((r) => {
            const pct = caTotal > 0 ? (r.value / caTotal) * 100 : 0;
            return (
              <div key={r.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{r.label}</span>
                  <span className="tabular-nums font-medium">{formatCurrency(r.value)} · {pct.toFixed(1)} %</span>
                </div>
                <div className="w-full h-3 bg-midnight-50 rounded overflow-hidden">
                  <div className={`h-full ${r.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {caTotal === 0 && <div className="text-sm text-midnight-500 italic">Aucun CA sur cette période.</div>}
        </div>
      </div>

      {/* ─── Dépenses par catégorie ─── */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono uppercase tracking-widest text-midnight-500">Dépenses par poste (factures fournisseurs)</h2>
            <span className="text-xs text-midnight-500">Total : <strong className="text-midnight-900">{formatCurrency(supplierExpensesTotal)}</strong></span>
          </div>
          <div className="space-y-2">
            {supplierCategoriesSorted.slice(0, 10).map((c) => {
              const pct = supplierExpensesTotal > 0 ? (c.total / supplierExpensesTotal) * 100 : 0;
              return (
                <div key={c.cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{c.label} <span className="text-midnight-400">({c.count})</span></span>
                    <span className="tabular-nums font-medium">{formatCurrency(c.total)} · {pct.toFixed(1)} %</span>
                  </div>
                  <div className="w-full h-2 bg-midnight-50 rounded overflow-hidden">
                    <div className="h-full bg-red-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {supplierCategoriesSorted.length === 0 && <div className="text-sm text-midnight-500 italic">Aucune facture fournisseur.</div>}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono uppercase tracking-widest text-midnight-500">Notes de frais par catégorie</h2>
            <span className="text-xs text-midnight-500">Total : <strong className="text-midnight-900">{formatCurrency(employeeExpensesTotal)}</strong></span>
          </div>
          <div className="space-y-2">
            {employeeCategoriesSorted.slice(0, 10).map((c) => {
              const pct = employeeExpensesTotal > 0 ? (c.total / employeeExpensesTotal) * 100 : 0;
              return (
                <div key={c.cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{c.label} <span className="text-midnight-400">({c.count})</span></span>
                    <span className="tabular-nums font-medium">{formatCurrency(c.total)} · {pct.toFixed(1)} %</span>
                  </div>
                  <div className="w-full h-2 bg-midnight-50 rounded overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {employeeCategoriesSorted.length === 0 && <div className="text-sm text-midnight-500 italic">Aucune note de frais.</div>}
          </div>
        </div>
      </div>

      {/* ─── Top 15 grosses dépenses ─── */}
      <div className="card mb-6">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-mono uppercase tracking-widest text-midnight-500">Top 15 des grosses dépenses</h2>
          <span className="text-xs text-midnight-500">Toutes sources · TTC</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-midnight-50/40">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Date</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Type</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Description</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Fournisseur / Auteur</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Catégorie</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Montant TTC</th>
            </tr>
          </thead>
          <tbody>
            {bigExpenses.map((e) => (
              <tr key={`${e.kind}-${e.id}`} className="border-t border-border/40 hover:bg-midnight-50/30">
                <td className="px-3 py-2 tabular-nums text-xs text-midnight-500">{e.date.toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2">
                  <span className={`badge-${e.kind === "SUPPLIER" ? "info" : "warning"} text-[10px]`}>
                    {e.kind === "SUPPLIER" ? "Fournisseur" : "Note de frais"}
                  </span>
                </td>
                <td className="px-3 py-2">{e.label}</td>
                <td className="px-3 py-2 text-midnight-500">{e.supplier ?? e.author ?? ""}</td>
                <td className="px-3 py-2 text-xs text-midnight-500">{e.category}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-red-700">{formatCurrency(e.amountTtc)}</td>
              </tr>
            ))}
            {bigExpenses.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-midnight-500 italic">Aucune dépense enregistrée.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Breakdown par personne ─── */}
      <div className="card mb-6">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-mono uppercase tracking-widest text-midnight-500">Performance par personne</h2>
          <span className="text-xs text-midnight-500">
            Basé sur les heures validées · CA T&M = heures × (dailyRate/8) · Coût = heures × hourlyCost
          </span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-midnight-50/40">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Consultant</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Rôle</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Heures validées</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-midnight-500 uppercase">CA généré</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Coût interne</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Marge</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-midnight-500 uppercase">Marge %</th>
            </tr>
          </thead>
          <tbody>
            {perPersonSorted.map((p) => (
              <tr key={p.userId} className="border-t border-border/40 hover:bg-midnight-50/30">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/users/${p.userId}`} className="hover:text-indigoaccent">{p.name}</Link>
                </td>
                <td className="px-3 py-2 text-xs text-midnight-500">{p.role}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.hours.toFixed(1)}h</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">{formatCurrency(p.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-700">{formatCurrency(p.cost)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${p.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatCurrency(p.margin)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-midnight-500">
                  {p.revenue > 0 ? `${p.marginPct.toFixed(1)}%` : "—"}
                </td>
              </tr>
            ))}
            {perPersonSorted.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-midnight-500 italic">Aucune heure validée sur cette période.</td></tr>
            )}
          </tbody>
          {perPersonSorted.length > 0 && (
            <tfoot>
              <tr className="bg-midnight-50/40 font-medium">
                <td className="px-3 py-2" colSpan={2}>Total équipe</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {perPersonSorted.reduce((s, p) => s + p.hours, 0).toFixed(1)}h
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatCurrency(totalPersonRevenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-700">{formatCurrency(totalPersonCost)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${totalPersonRevenue >= totalPersonCost ? "text-emerald-700" : "text-red-700"}`}>
                  {formatCurrency(totalPersonRevenue - totalPersonCost)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {totalPersonRevenue > 0 ? `${(((totalPersonRevenue - totalPersonCost) / totalPersonRevenue) * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Note méthodo */}
      <div className="text-xs text-midnight-500 italic space-y-1 max-w-3xl">
        <p><strong>Notes méthodologiques :</strong></p>
        <p>• <strong>CA</strong> = somme des tranches de facturation (BillingMilestone) non annulées avec date d'échéance dans l'année, HTVA. Inclut PLANNED, INVOICED, TRANSMITTED, PAID.</p>
        <p>• <strong>Dépenses totales</strong> = factures fournisseurs (SupplierInvoice) + notes de frais approuvées ou soumises (ExpenseReport), TTC. Les dépenses récurrentes (RecurringExpense) ne sont PAS incluses ici — voir Cashflow pour le prévisionnel complet.</p>
        <p>• <strong>CA généré par personne</strong> = heures validées × (dailyRate mission / 8). Uniquement pour les missions T&M — le CA projet forfait n'est pas ventilé par personne car un projet est collectif.</p>
        <p>• <strong>Coût interne</strong> = heures validées × hourlyCost du profil user. Ne reflète pas les charges patronales (multiplier par ~1.5 pour coût employeur réel).</p>
      </div>
    </div>
  );
}
