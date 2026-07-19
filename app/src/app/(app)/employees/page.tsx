import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeesTable } from "./table";
import { formatCurrency } from "@/lib/utils";
import { UserPlus, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Configuration paie des employés Dasolabs.
 *
 * Trois blocs :
 *  1. KPIs mensuels (nb actifs, sommes)
 *  2. « À configurer » : candidats + consultants flag=EMPLOYEE mais sans
 *     PayrollEmployee lié — chaque ligne a un bouton "Configurer la paie"
 *  3. Table des employés déjà configurés (édition inline)
 *
 * Le cashflow injecte automatiquement 3 lignes agrégées (Salaires /
 * Précompte / ONSS) sommées sur les employés actifs au mois considéré.
 */
export default async function EmployeesPage() {
  await requirePermission("finance.write");
  const [employees, candidatesToConfig, usersToConfig] = await Promise.all([
    prisma.payrollEmployee.findMany({
      orderBy: [{ endDate: { sort: "asc", nulls: "first" } }, { startDate: "asc" }],
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true } },
        user:      { select: { id: true, firstName: true, lastName: true } }
      }
    }),
    // Candidats flag=EMPLOYEE sans PayrollEmployee lié
    prisma.candidate.findMany({
      where: {
        contractType: "EMPLOYEE",
        payrollEmployee: null,
        status: { in: ["ACTIVE", "ENGAGED"] }
      },
      select: { id: true, firstName: true, lastName: true, seniority: true }
    }),
    // Consultants internes flag=EMPLOYEE sans PayrollEmployee lié
    prisma.user.findMany({
      where: {
        contractType: "EMPLOYEE",
        payrollEmployee: null,
        active: true,
        candidateProfile: { is: null }   // exclut les comptes portail candidat
      },
      select: { id: true, firstName: true, lastName: true, role: true }
    })
  ]);

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

  const toConfigCount = candidatesToConfig.length + usersToConfig.length;

  return (
    <div>
      <PageHeader
        title="Employés"
        subtitle="Configuration paie des salariés Dasolabs. Le cashflow agrège automatiquement les 3 lignes Salaires / Précompte / ONSS."
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

      {/* Panneau "À configurer" — profils flag=EMPLOYEE sans paie */}
      {toConfigCount > 0 && (
        <section className="card p-4 mb-5 border-amber-200 bg-amber-50/40">
          <h2 className="font-semibold flex items-center gap-2 mb-3 text-amber-900">
            <AlertCircle className="w-4 h-4" />
            À configurer ({toConfigCount})
          </h2>
          <p className="text-xs text-midnight-600 mb-3">
            Ces personnes sont marquées « Employé Dasolabs » sur leur fiche mais n'ont pas encore de paie configurée.
          </p>
          <ul className="divide-y divide-amber-200">
            {candidatesToConfig.map((c) => (
              <li key={c.id} className="py-2 flex items-center justify-between">
                <div className="text-sm">
                  <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  {c.seniority && <span className="text-xs text-midnight-500 ml-2">— {c.seniority}</span>}
                  <span className="badge-neutral text-[10px] ml-2">Candidat</span>
                </div>
                <ConfigureButton candidateId={c.id} firstName={c.firstName} lastName={c.lastName} />
              </li>
            ))}
            {usersToConfig.map((u) => (
              <li key={u.id} className="py-2 flex items-center justify-between">
                <div className="text-sm">
                  <Link href={`/users/${u.id}`} className="font-medium hover:underline">
                    {u.firstName} {u.lastName}
                  </Link>
                  <span className="text-xs text-midnight-500 ml-2">— {u.role}</span>
                  <span className="badge-info text-[10px] ml-2">Consultant interne</span>
                </div>
                <ConfigureButton userId={u.id} firstName={u.firstName} lastName={u.lastName} />
              </li>
            ))}
          </ul>
        </section>
      )}

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
        notes: e.notes,
        candidateId: e.candidateId,
        userId: e.userId,
        sourceLink: e.candidate
          ? { href: `/candidates/${e.candidate.id}`, label: "Fiche candidat" }
          : e.user
            ? { href: `/users/${e.user.id}`, label: "Fiche consultant" }
            : null
      }))} />
    </div>
  );
}

/**
 * Petit bouton Link vers la table d'édition avec les IDs de source
 * pré-remplis en query params. Rendu server-side pour éviter un client
 * component supplémentaire.
 */
function ConfigureButton({
  candidateId, userId, firstName, lastName
}: {
  candidateId?: string;
  userId?: string;
  firstName: string;
  lastName: string;
}) {
  const params = new URLSearchParams();
  if (candidateId) params.set("candidateId", candidateId);
  if (userId) params.set("userId", userId);
  params.set("firstName", firstName);
  params.set("lastName", lastName);
  return (
    <Link
      href={`/employees?${params.toString()}#configure`}
      className="btn-primary btn-sm"
    >
      <UserPlus className="w-3 h-3" /> Configurer la paie
    </Link>
  );
}
