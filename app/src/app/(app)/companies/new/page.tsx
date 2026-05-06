import { PageHeader } from "@/components/ui/page-header";
import { CompanyForm } from "../company-form";
import { requirePermission } from "@/lib/rbac";

export default async function NewCompanyPage() {
  await requirePermission("companies.write");
  return (
    <div>
      <PageHeader title="Nouvelle entreprise" breadcrumb={[{ label: "Entreprises", href: "/companies" }, { label: "Nouvelle" }]} />
      <CompanyForm />
    </div>
  );
}
