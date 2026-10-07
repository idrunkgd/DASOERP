import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { updateCompanySite, deleteCompanySite } from "@/server/actions/company-sites";
import { ConfirmButton } from "@/components/ui/confirm";
import { SiteForm } from "../site-form";

export const dynamic = "force-dynamic";

export default async function EditSitePage({ params }: { params: { id: string; siteId: string } }) {
  await requirePermission("companies.write");
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, name: true }
  });
  if (!company) notFound();
  const site = await (prisma as any).companySite.findUnique({
    where: { id: params.siteId }
  });
  if (!site || site.companyId !== params.id) notFound();

  async function action(fd: FormData) {
    "use server";
    await updateCompanySite(params.siteId, fd);
  }

  return (
    <div>
      <PageHeader
        title={site.name}
        subtitle={company.name}
        breadcrumb={[
          { label: "Entreprises", href: "/companies" },
          { label: company.name, href: `/companies/${company.id}` },
          { label: site.name }
        ]}
        actions={
          <ConfirmButton
            onConfirm={async () => { "use server"; await deleteCompanySite(params.siteId); }}
            message={`Supprimer le site "${site.name}" ?`}
          >
            Supprimer
          </ConfirmButton>
        }
      />
      <SiteForm action={action} initial={site} companyId={company.id} />
    </div>
  );
}
