import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { CostCenterForm } from "../cost-center-form";

export default async function EditCC({ params }: { params: { id: string } }) {
  await requirePermission("settings.manage");
  const c = await prisma.costCenter.findUnique({ where: { id: params.id } });
  if (!c) notFound();
  return (
    <div>
      <PageHeader title={c.name} breadcrumb={[{ label: "Centres de coût", href: "/cost-centers" }, { label: c.code }]} />
      <CostCenterForm initial={c} />
    </div>
  );
}
