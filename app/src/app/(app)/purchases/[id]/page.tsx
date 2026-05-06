import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseForm } from "../purchase-form";

export default async function EditPurchase({ params }: { params: { id: string } }) {
  await requirePermission("purchases.write");
  const p = await prisma.purchase.findUnique({ where: { id: params.id } });
  if (!p) notFound();
  const [projects, suppliers] = await Promise.all([
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, reference: true } }),
    prisma.company.findMany({ where: { status: { in: ["SUPPLIER","PARTNER"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);
  return (
    <div>
      <PageHeader title="Modifier achat" breadcrumb={[{ label: "Achats", href: "/purchases" }, { label: p.description }]} />
      <PurchaseForm initial={p} projects={projects} suppliers={suppliers} />
    </div>
  );
}
