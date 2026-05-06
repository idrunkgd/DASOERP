import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { PurchaseForm } from "../purchase-form";

export default async function NewPurchase() {
  await requirePermission("purchases.write");
  const [projects, suppliers] = await Promise.all([
    prisma.project.findMany({ where: { status: { in: ["TO_START","ACTIVE","ON_HOLD"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, reference: true } }),
    prisma.company.findMany({ where: { status: { in: ["SUPPLIER","PARTNER"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } })
  ]);
  return (
    <div>
      <PageHeader title="Nouvel achat" breadcrumb={[{ label: "Achats", href: "/purchases" }, { label: "Nouveau" }]} />
      <PurchaseForm projects={projects} suppliers={suppliers} />
    </div>
  );
}
