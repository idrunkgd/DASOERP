import { requirePermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { ContactImportClient } from "./import-client";

export default async function ImportContactsPage() {
  await requirePermission("contacts.write");
  return (
    <div>
      <PageHeader
        title="Import CSV — contacts"
        breadcrumb={[{ label: "Contacts", href: "/contacts" }, { label: "Import" }]}
        subtitle="Colonnes attendues : firstName, lastName, email, phone, jobTitle, status, companyName, tags, notes (les variantes 'prenom', 'nom', 'fonction', 'entreprise'... sont acceptées). Match sur email si présent, sinon nom + entreprise. L'entreprise est créée si elle n'existe pas."
      />
      <ContactImportClient />
    </div>
  );
}
