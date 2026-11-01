import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { BenchmarkView } from "./view";

export const dynamic = "force-dynamic";

export default async function CandidatesBenchmarkPage() {
  await requirePermission("consulting.read");

  const candidates = await prisma.candidate.findMany({
    where: {
      status: { in: ["ACTIVE", "UNAVAILABLE", "ENGAGED"] },
      convertedToUser: { is: null }
    },
    orderBy: [{ lastName: "asc" }],
    include: {
      salaryScenarios: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { grossMonthly: true }
      }
    }
  });

  const points = candidates
    .filter((c: any) => c.salaryScenarios?.[0]?.grossMonthly)
    .map((c: any) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      years: c.yearsExperience ?? 0,
      rate: Number(c.salaryScenarios[0].grossMonthly),
      seniority: c.seniority ?? null,
      skills: c.skills ?? []
    }));

  return (
    <div>
      <PageHeader
        title="Benchmark salaires candidats"
        subtitle={`${points.length} candidat${points.length > 1 ? "s" : ""} avec simulation de package renseignée · médiane utilisée pour éviter les biais d'extrêmes`}
        breadcrumb={[{ label: "Candidats", href: "/candidates" }, { label: "Benchmark" }]}
      />
      <BenchmarkView points={points} />
    </div>
  );
}
