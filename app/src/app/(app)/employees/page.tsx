import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeesTable } from "./table";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Configuration des employés Dasolabs. Chaque employé a 3 sorties
 * mensuelles (net / précompte pro / ONSS) qui alimentent AUTOMATIQUEMENT
 * les 3 lignes agrégées « Salaires / Précompte / ONSS » dans le cashflow.
 * Un départ (endDate) → l'employé n'est plus compté à partir du mois suivant.
 */
export default async function EmployeesPage() {
  await requirePermission("finance.write");
  const employees = await prisma.payrollEmployee.findMany({
    orderBy: [{ endDate: { sort: "asc", nulls: "first" } }, { startDate: "asc" }]
  });

  // Vue mensuelle globale (pour info) : total actuel des 3 postes
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const active = employees.filter(
    (e) => e.startDate <= monthEnd && (e.endDate == null || e.endDate >= monthStart)
  );
  const totalNet   = active.reduce((s, e) => s + Number(e.monthlyNetPay), 0);
  const totalTax   = active.reduce((s, e) => s + Number(e.monthlyWithholdingTax), 0);
  const totalOnss  = active.reduce((s, e) => s + Number(e.monthlyOnss), 0);
  const totalMonth = totalNet + totalTax + totalOnss;

  return (
    <div>
      <PageHeader
        title="Employés"
        subtitle="Configuration des salaires, précomptes et ONSS. Le cashflow affiche 3 lignes agrégées automatiquement."
      />

      {/* Résumé mensuel courant */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-xs text-midnight-500 uppercase">Employés actifs</div>
          <div className="text-2xl font-bold mt-1">{active.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-midnight-500 uppercase">Salaires nets / mois</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(totalNet)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-midnight-500 uppercase">Précompte / mois</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(totalTax)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-midnight-500 uppercase">ONSS / mois</div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(totalOnss)}</div>
        </div>
      </div>

      <div className="text-xs text-midnight-500 mb-3">
        Coût total employeur ce mois-ci : <strong className="text-midnight-900">{formatCurrency(totalMonth)}</strong>
      </div>

      <EmployeesTable employees={employees.map((e) => ({
        id: e.id,
        firstName: e.firstName, lastName: e.lastName,
        role: e.role,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
        monthlyNetPay: Number(e.monthlyNetPay),
        monthlyWithholdingTax: Number(e.monthlyWithholdingTax),
        monthlyOnss: Number(e.monthlyOnss),
        monthlyGrossReference: e.monthlyGrossReference ? Number(e.monthlyGrossReference) : null,
        monthsPerYear: Number(e.monthsPerYear),
        notes: e.notes
      }))} />
    </div>
  );
}
