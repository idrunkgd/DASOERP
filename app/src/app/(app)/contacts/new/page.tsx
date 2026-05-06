import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "../contact-form";

export default async function NewContact({ searchParams }: { searchParams: { companyId?: string } }) {
  await requirePermission("contacts.write");
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div>
      <PageHeader title="Nouveau contact" breadcrumb={[{ label: "Contacts", href: "/contacts" }, { label: "Nouveau" }]} />
      <ContactForm companies={companies} defaultCompanyId={searchParams.companyId} />
    </div>
  );
}
