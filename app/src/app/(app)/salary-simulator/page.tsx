import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Calculator } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DEFAULT_SALARY_INPUTS } from "@/lib/salary-calc";
import { Simulator } from "./simulator";
import { DeleteScenarioButton } from "./delete-scenario-button";

export const dynamic = "force-dynamic";

export default async function SalarySimulatorPage({
  searchParams
}: {
  searchParams: { scenario?: string; candidate?: string };
}) {
  await requirePermission("consulting.read");

  const candidates = await prisma.candidate.findMany({
    where: { status: "ACTIVE", convertedToUser: { is: null } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      seniority: true,
      city: true
    }
  });

  // Charger un scénario existant si demandé via ?scenario=ID
  let initialScenario: any = null;
  if (searchParams.scenario) {
    const sc = await prisma.candidateSalaryScenario.findUnique({
      where: { id: searchParams.scenario }
    });
    if (sc) {
      initialScenario = {
        id: sc.id,
        candidateId: sc.candidateId,
        label: sc.label,
        grossMonthly: Number(sc.grossMonthly),
        monthsPerYear: Number(sc.monthsPerYear),
        employerChargesPct: Number(sc.employerChargesPct),
        workingDaysPerWeek: Number(sc.workingDaysPerWeek),
        workingDaysPerYear: sc.workingDaysPerYear,
        carMonthlyTco: Number(sc.carMonthlyTco),
        mealVoucherEmployerPerDay: Number(sc.mealVoucherEmployerPerDay),
        ecoVouchersAnnual: Number(sc.ecoVouchersAnnual),
        groupInsurancePct: Number(sc.groupInsurancePct),
        hospitalInsuranceMonthly: Number(sc.hospitalInsuranceMonthly),
        phoneInternetMonthly: Number(sc.phoneInternetMonthly),
        netExpensesMonthly: Number(sc.netExpensesMonthly),
        targetMarginPct: Number(sc.targetMarginPct),
        soldDailyRate: Number(sc.soldDailyRate),
        notes: sc.notes
      };
    }
  }

  const initial = initialScenario ?? {
    candidateId: searchParams.candidate ?? null,
    label: "",
    notes: "",
    ...DEFAULT_SALARY_INPUTS
  };

  // Liste des scénarios récents
  const recent = await prisma.candidateSalaryScenario.findMany({
    take: 25,
    orderBy: { createdAt: "desc" },
    include: {
      candidate: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } }
    }
  });

  return (
    <div>
      <PageHeader
        title="Simulateur de package"
        subtitle="À partir d'un brut demandé, calcule le coût employeur total et le TJM facturable"
      />

      <Simulator
        candidates={candidates.map((c) => ({
          id: c.id,
          label: `${c.lastName} ${c.firstName}${c.seniority ? ` · ${c.seniority}` : ""}${c.city ? ` · ${c.city}` : ""}`
        }))}
        initial={initial}
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-3">
          Simulations récentes ({recent.length})
        </h2>
        <div className="card overflow-hidden">
          {recent.length === 0 ? (
            <EmptyState
              icon={Calculator}
              title="Aucune simulation sauvegardée"
              description="Configurez un package ci-dessus puis cliquez sur « Sauvegarder »."
            />
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Libellé</th>
                  <th>Candidat</th>
                  <th className="text-right">Brut/mois</th>
                  <th className="text-right">Coût/an</th>
                  <th className="text-right">TJM coût</th>
                  <th className="text-right">TJM facturable</th>
                  <th>Créé par</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/salary-simulator?scenario=${s.id}`}
                        className="font-medium hover:underline"
                      >
                        {s.label}
                      </Link>
                    </td>
                    <td className="text-midnight-700">
                      {s.candidate ? (
                        <Link
                          href={`/candidates/${s.candidate.id}`}
                          className="hover:underline"
                        >
                          {s.candidate.firstName} {s.candidate.lastName}
                        </Link>
                      ) : (
                        <span className="text-midnight-400">—</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(s.grossMonthly)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(s.totalAnnualCost)}
                    </td>
                    <td className="text-right tabular-nums">
                      {formatCurrency(s.costPerDay)}
                    </td>
                    <td className="text-right tabular-nums font-medium text-emerald-700">
                      {formatCurrency(s.billableRate)}
                    </td>
                    <td className="text-xs text-midnight-500">
                      {s.createdBy
                        ? `${s.createdBy.firstName} ${s.createdBy.lastName[0]}.`
                        : "—"}
                    </td>
                    <td className="text-xs text-midnight-500">
                      {formatDate(s.createdAt)}
                    </td>
                    <td>
                      <DeleteScenarioButton id={s.id} label={s.label} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
