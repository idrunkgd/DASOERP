import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { MissionForm } from "../mission-form";

export default async function NewMission() {
  const session = await requirePermission("consulting.write");
  const [companies, contacts, users] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.contact.findMany({ orderBy: [{ lastName: "asc" }], select: { id: true, firstName: true, lastName: true, companyId: true } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } })
  ]);
  return (
    <div>
      <PageHeader title="Nouvelle demande de mission" breadcrumb={[{ label: "Missions", href: "/mission-requests" }, { label: "Nouvelle" }]} />
      <MissionForm companies={companies} contacts={contacts} users={users} initialOwnerId={session.user.id} />
    </div>
  );
}
