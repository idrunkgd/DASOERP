import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { createCompanySite } from "@/server/actions/company-sites";
import { SiteForm } from "../site-form";

export const dynamic = "force-dynamic";

export default async function NewSitePage({ params }: { params: { id: string } }) {
  await requirePermission("companies.write");
  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, name: true }
  });
  if (!company) notFound();

  async function action(fd: FormData) {
    "use server";
    await createCompanySite(params.id, fd);
  }

  return (
    <div>
      <PageHeader
        title="Nouveau site"
        subtitle={company.name}
        breadcrumb={[
          { label: "Entreprises", href: "/companies" },
          { label: company.name, href: `/companies/${company.id}` },
          { label: "Nouveau site" }
        ]}
      />
      <SiteForm action={action} companyId={company.id} />
    </div>
  );
}
