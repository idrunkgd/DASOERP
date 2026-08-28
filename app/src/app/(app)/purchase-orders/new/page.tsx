import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ArrowLeft } from "lucide-react";
import { POForm } from "../po-form";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage({
  searchParams
}: { searchParams: { projectId?: string } }) {
  await requirePermissionOrRedirect("purchases.write");
  const [suppliers, projects] = await Promise.all([
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true, name: true }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Nouveau bon de commande"
        subtitle="La référence PO-AAAA-NNNN sera générée automatiquement à la création"
        actions={
          <Link href="/purchase-orders" className="btn-ghost text-sm inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Link>
        }
      />
      <POForm
        suppliers={suppliers}
        projects={projects}
        initial={{
          title: "",
          projectId: searchParams.projectId ?? null,
          currency: "EUR",
          lines: []
        }}
      />
    </div>
  );
}
