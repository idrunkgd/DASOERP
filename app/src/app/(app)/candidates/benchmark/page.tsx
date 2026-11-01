import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { BenchmarkView } from "./view";

export const dynamic = "force-dynamic";

export default async function CandidatesBenchmarkPage() {
  await requirePermission("consulting.read");

  // Catalogue officiel — seule source utilisée pour l'autocomplete du filtre.
  // Évite que des strings libres venus d'anciens imports CV polluent la liste.
  const catalog = await prisma.skill.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { name: true }
  });
  const catalogSkills = catalog.map((s) => s.name);

  const candidates = await prisma.candidate.findMany({
    where: {
      status: { in: ["ACTIVE", "UNAVAILABLE", "ENGAGED"] },
      convertedToUser: { is: null }
    },
    orderBy: [{ lastName: "asc" }],
    include: {
      salaryScenarios: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { grossMonthly: true, soldDailyRate: true, billableRate: true, costPerDay: true }
      }
    }
  });

  const points = candidates
    .filter((c: any) => c.salaryScenarios?.[0]?.grossMonthly)
    .map((c: any) => {
      const sc = c.salaryScenarios[0];
      // TJM : priorité au TJM vendu client (si > 0), sinon TJM suggéré (billableRate)
      // avec marge, sinon le tarif min du candidat.
      const sold = Number(sc.soldDailyRate ?? 0);
      const billable = Number(sc.billableRate ?? 0);
      const minDailyRate = c.minDailyRate ? Number(c.minDailyRate) : 0;
      const tjm = sold > 0 ? sold : (billable > 0 ? billable : minDailyRate);
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        years: c.yearsExperience ?? 0,
        rate: Number(sc.grossMonthly),
        tjm,
        tjmLabel: sold > 0 ? "TJM vendu" : (billable > 0 ? "TJM suggéré" : "Min. demandé"),
        costPerDay: sc.costPerDay ? Number(sc.costPerDay) : 0,
        seniority: c.seniority ?? null,
        skills: c.skills ?? []
      };
    });

  return (
    <div>
      <PageHeader
        title="Benchmark salaires candidats"
        subtitle={`${points.length} candidat${points.length > 1 ? "s" : ""} avec simulation de package renseignée · médiane utilisée pour éviter les biais d'extrêmes`}
        breadcrumb={[{ label: "Candidats", href: "/candidates" }, { label: "Benchmark" }]}
      />
      <BenchmarkView points={points} catalogSkills={catalogSkills} />
    </div>
  );
}
