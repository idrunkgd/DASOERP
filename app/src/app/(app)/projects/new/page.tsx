import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "../project-form";

export default async function NewProject() {
  await requirePermission("projects.write");
  const [companies, users] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } })
  ]);
  return (
    <div>
      <PageHeader title="Nouveau projet" breadcrumb={[{ label: "Projets", href: "/projects" }, { label: "Nouveau" }]} />
      <ProjectForm companies={companies} users={users} />
    </div>
  );
}
