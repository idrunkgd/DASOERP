import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { getCompanyInfo } from "@/lib/company-info";
import { CompanyInfoForm } from "./form";

export const dynamic = "force-dynamic";

export default async function CompanyInfoPage() {
  await requirePermission("settings.manage");
  const info = await getCompanyInfo();

  return (
    <div>
      <PageHeader
        title="Informations légales de l'entreprise"
        subtitle="Ces données alimentent les PDFs (devis, factures), les exports comptables et les emails sortants"
        breadcrumb={[{ label: "Paramètres", href: "/settings" }, { label: "Entreprise" }]}
      />
      <CompanyInfoForm initial={info} />
    </div>
  );
}
