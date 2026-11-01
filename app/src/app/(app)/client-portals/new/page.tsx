import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewPortalForm } from "./form";

export const dynamic = "force-dynamic";

export default async function NewClientPortalPage() {
  await requirePermission("consulting.write");
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, status: true }
  });

  return (
    <div>
      <PageHeader
        title="Nouveau portail client"
        subtitle="Crée un lien unique et immuable pour un client/équipe. Il ne change jamais, sauf si tu demandes explicitement une régénération."
        breadcrumb={[
          { label: "Portails clients", href: "/client-portals" },
          { label: "Nouveau" }
        ]}
      />
      <NewPortalForm companies={companies} />
    </div>
  );
}
