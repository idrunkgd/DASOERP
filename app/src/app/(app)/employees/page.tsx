import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmployeesTable } from "./table";
import { formatCurrency } from "@/lib/utils";
import { computeBelgianPayroll, computeBelgianPayrollFromPackage } from "@/lib/belgian-payroll";
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
  // Liste des consultants internes auxquels on peut lier un payroll employee
  // (pour les lignes payroll créées en standalone sans fiche source).
  const availableConsultants = await prisma.user.findMany({
    where: { contractType: "EMPLOYEE", active: true, candidateProfile: { is: null } },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }]
  });
  // Note : on ne liste PAS les Candidats ici, même flaggés EMPLOYEE. Tant
  // qu'ils ne sont pas recrutés (convertedToUserId=null), ils ne sont pas
  // encore engagés → aucune paie à configurer. Dès qu'ils passent User,
  // ils apparaîtront naturellement dans usersToConfig si leur User a
  // contractType=EMPLOYEE.
  const [employees, usersToConfig] = await Promise.all([
    prisma.payrollEmployee.findMany({
      orderBy: [{ endDate: { sort: "asc", nulls: "first" } }, { startDate: "asc" }],
      include: {
        candidate: {
          select: {
            id: true, firstName: true, lastName: true,
            salaryScenarios: {
              orderBy: { createdAt: "desc" }, take: 1
            }
          }
        },
        user: {
          select: {
            id: true, firstName: true, lastName: true,
            // Un User recruté depuis le vivier a sa fiche candidat liée via
            // recruitedFromCandidate (relation CandidatePromotion). C'est là
            // que vit le simulateur de package → brut + voiture + chèques + ATN
            recruitedFromCandidate: {
              select: {
                salaryScenarios: {
                  orderBy: { createdAt: "desc" }, take: 1
                }
              }
            }
          }
        }
      }
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

  const toConfigCount = usersToConfig.length;

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

      <EmployeesTable employees={employees.map((e) => {
        // Récupère le dernier scénario de package complet depuis la fiche
        // candidat ou le candidat recruté (consultant interne).
        const scenario = e.candidate?.salaryScenarios?.[0]
          ?? (e.user as any)?.recruitedFromCandidate?.salaryScenarios?.[0]
          ?? null;
        const scenarioGross = scenario?.grossMonthly != null ? Number(scenario.grossMonthly) : null;
        // Decimal Prisma = objet toujours truthy, donc on compare Number > 0.
        const storedGrossNum = e.monthlyGrossReference != null ? Number(e.monthlyGrossReference) : 0;
        const storedGross = storedGrossNum > 0 ? storedGrossNum : null;
        const effectiveGross = storedGross ?? (scenarioGross && scenarioGross > 0 ? scenarioGross : null);

        // Package merge : les champs saisis sur PayrollEmployee (> 0) ont la
        // priorité sur ceux du scénario candidat. Permet d'ajouter des frais
        // de représentation / voiture à n'importe quel employé, même sans
        // candidat d'origine.
        const pkgVal = (field: keyof typeof e, scenarioField?: string) => {
          const stored = Number((e as any)[field] ?? 0);
          if (stored > 0) return stored;
          const scen = scenario && scenarioField ? Number((scenario as any)[scenarioField] ?? 0) : 0;
          return scen;
        };
        const mergedPackage = effectiveGross ? {
          grossMonthly:              effectiveGross,
          carMonthlyTco:             pkgVal("carMonthlyTco",             "carMonthlyTco"),
          mealVoucherEmployerPerDay: pkgVal("mealVoucherEmployerPerDay", "mealVoucherEmployerPerDay"),
          ecoVouchersAnnual:         pkgVal("ecoVouchersAnnual",         "ecoVouchersAnnual"),
          hospitalInsuranceMonthly:  pkgVal("hospitalInsuranceMonthly",  "hospitalInsuranceMonthly"),
          phoneInternetMonthly:      pkgVal("phoneInternetMonthly",      "phoneInternetMonthly"),
          netExpensesMonthly:        pkgVal("netExpensesMonthly",        "netExpensesMonthly")
        } : null;
        const hasAnyPerk = mergedPackage ? (
          mergedPackage.carMonthlyTco + mergedPackage.mealVoucherEmployerPerDay +
          mergedPackage.ecoVouchersAnnual + mergedPackage.hospitalInsuranceMonthly +
          mergedPackage.phoneInternetMonthly + mergedPackage.netExpensesMonthly
        ) > 0 : false;

        const fullCalc = mergedPackage && hasAnyPerk
          ? computeBelgianPayrollFromPackage(mergedPackage)
          : null;
        const simpleCalc = effectiveGross && !fullCalc ? computeBelgianPayroll(effectiveGross) : null;
        const payrollCalc = fullCalc ?? simpleCalc;
        return {
          id: e.id,
          firstName: e.firstName, lastName: e.lastName,
          startDate: e.startDate.toISOString().slice(0, 10),
          endDate: e.endDate ? e.endDate.toISOString().slice(0, 10) : null,
          monthlyNetPay: Number(e.monthlyNetPay),
          monthlyWithholdingTax: Number(e.monthlyWithholdingTax),
          monthlyOnss: Number(e.monthlyOnss),
          monthlyGrossReference: storedGross,
          monthsPerYear: Number(e.monthsPerYear),
          notes: e.notes,
          candidateId: e.candidateId,
          userId: e.userId,
          scenarioGross: scenarioGross ? Number(scenarioGross) : null,
          effectiveGross,
          carMonthlyTco:             Number((e as any).carMonthlyTco ?? 0),
          mealVoucherEmployerPerDay: Number((e as any).mealVoucherEmployerPerDay ?? 0),
          ecoVouchersAnnual:         Number((e as any).ecoVouchersAnnual ?? 0),
          hospitalInsuranceMonthly:  Number((e as any).hospitalInsuranceMonthly ?? 0),
          phoneInternetMonthly:      Number((e as any).phoneInternetMonthly ?? 0),
          netExpensesMonthly:        Number((e as any).netExpensesMonthly ?? 0),
          payrollCalc: payrollCalc ? {
            net: payrollCalc.net,
            withholdingTax: payrollCalc.withholdingTax,
            onssEmployee: payrollCalc.onssEmployee,
            totalEmployerCost: payrollCalc.totalEmployerCost
          } : null,
          packageDetail: fullCalc ? {
            atnCar: fullCalc.atnCar,
            atnPhone: fullCalc.atnPhone,
            atnHospital: fullCalc.atnHospital,
            mealVouchersNetMonthly: fullCalc.mealVouchersNetMonthly,
            ecoVouchersNetMonthly: fullCalc.ecoVouchersNetMonthly,
            netExpensesMonthly: fullCalc.netExpensesMonthly,
            netCash: fullCalc.netCash,
            netTotalInHand: fullCalc.netTotalInHand,
            packageValueMonthly: fullCalc.packageValueMonthly
          } : null,
          sourceLink: e.candidate
            ? { href: `/candidates/${e.candidate.id}`, label: "Fiche candidat" }
            : e.user
              ? { href: `/consultants/${e.user.id}`, label: "Fiche consultant" }
              : null
        };
      })} availableConsultants={availableConsultants} />
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
