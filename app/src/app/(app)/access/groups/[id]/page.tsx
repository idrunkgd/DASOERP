import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { AccessGroupForm } from "../group-form";

export default async function EditAccessGroup({ params }: { params: { id: string } }) {
  await requirePermission("users.manage");
  const g = await prisma.accessGroup.findUnique({ where: { id: params.id } });
  if (!g) notFound();
  return (
    <div>
      <PageHeader title={g.name} breadcrumb={[{ label: "Accès", href: "/access" }, { label: g.name }]} subtitle={g.description ?? undefined} />
      <AccessGroupForm initial={g as any} />
    </div>
  );
}
