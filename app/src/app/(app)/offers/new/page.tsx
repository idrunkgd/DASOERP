import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { OfferHeaderForm } from "../offer-header-form";

export default async function NewOffer() {
  const session = await requirePermission("offers.write");
  const [companies, users] = await Promise.all([
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true, candidateProfile: { is: null } }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true } })
  ]);
  return (
    <div>
      <PageHeader title="Nouvelle offre" breadcrumb={[{ label: "Offres", href: "/offers" }, { label: "Nouvelle" }]} />
      <OfferHeaderForm companies={companies} users={users} initialOwnerId={session.user.id} />
    </div>
  );
}
