import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { UserForm } from "../user-form";
import { prisma } from "@/lib/db";

export default async function NewUser() {
  await requirePermission("users.manage");
  const skillCatalog = await prisma.skill.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="Nouvel utilisateur" breadcrumb={[{ label: "Utilisateurs", href: "/users" }, { label: "Nouveau" }]} />
      <UserForm skillCatalog={skillCatalog} />
    </div>
  );
}
