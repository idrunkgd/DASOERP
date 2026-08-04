import { redirect } from "next/navigation";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { createContractTemplate } from "@/server/actions/contracts";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  await requirePermissionOrRedirect("contracts.manage");

  async function action(fd: FormData) {
    "use server";
    const r = await createContractTemplate(fd);
    redirect(`/contracts/templates/${r.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Nouveau template de contrat"
        breadcrumb={[
          { label: "Contrats", href: "/contracts" },
          { label: "Nouveau template" }
        ]}
      />
      <form action={action} className="card p-6 max-w-2xl space-y-4">
        <div>
          <label className="label">Nom *</label>
          <input name="name" required className="input"
            placeholder='Ex: "CDI Consultant Dasolabs", "NDA freelance"' />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea name="description" rows={2} className="input"
            placeholder="Contexte / notes internes (facultatif)" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input name="active" type="checkbox" defaultChecked value="true" />
          <span>Actif (disponible pour la génération)</span>
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button className="btn-primary">Créer le template</button>
        </div>
      </form>
    </div>
  );
}
