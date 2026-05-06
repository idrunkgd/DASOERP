import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { CandidateForm } from "../candidate-form";
import { prisma } from "@/lib/db";

export default async function NewCandidate() {
  await requirePermission("consulting.write");
  const skillCatalog = await prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="Nouveau candidat" breadcrumb={[{ label: "Candidats", href: "/candidates" }, { label: "Nouveau" }]} />
      <CandidateForm skillCatalog={skillCatalog} />
    </div>
  );
}
