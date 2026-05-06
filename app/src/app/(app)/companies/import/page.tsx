import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { CompanyImportClient } from "./import-client";

export default async function ImportPage() {
  await requirePermission("companies.write");
  return (
    <div>
      <PageHeader
        title="Import CSV — entreprises"
        breadcrumb={[{ label: "Entreprises", href: "/companies" }, { label: "Import" }]}
        subtitle="Colonnes attendues : name, vatNumber, status, sector, size, website, source, street, postalCode, city, country, notes (les variantes 'nom', 'tva', 'ville'... sont acceptées). Match sur TVA si présent, sinon sur nom (insensible à la casse)."
      />
      <CompanyImportClient />
    </div>
  );
}
