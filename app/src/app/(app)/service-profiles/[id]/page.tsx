import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "../profile-form";

export default async function EditProfile({ params }: { params: { id: string } }) {
  await requirePermission("offers.write");
  const p = await prisma.serviceProfile.findUnique({ where: { id: params.id } });
  if (!p) notFound();
  return (
    <div>
      <PageHeader title={p.name} breadcrumb={[{ label: "Profils", href: "/service-profiles" }, { label: p.name }]} />
      <ProfileForm initial={p} />
    </div>
  );
}
