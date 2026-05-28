// Création d'une page wiki — formulaire simple, slug auto-généré.
import { requireSession } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { WikiPageForm } from "../wiki-page-form";

export const dynamic = "force-dynamic";

export default async function NewWikiPage() {
  await requireSession();
  return (
    <div>
      <PageHeader
        breadcrumb={[
          { label: "Wiki", href: "/knowledge" },
          { label: "Nouvelle page" }
        ]}
        title="Nouvelle page"
        subtitle="Édition en markdown — preview en temps réel."
      />
      <WikiPageForm mode="create" />
    </div>
  );
}
