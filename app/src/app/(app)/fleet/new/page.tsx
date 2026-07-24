import { redirect } from "next/navigation";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { createVehicle } from "@/server/actions/fleet";

export const dynamic = "force-dynamic";

export default async function NewVehiclePage() {
  await requirePermissionOrRedirect("fleet.manage");

  async function action(fd: FormData) {
    "use server";
    const r = await createVehicle(fd);
    redirect(`/fleet/${r.id}`);
  }

  return (
    <div>
      <PageHeader
        title="Nouveau véhicule"
        breadcrumb={[{ label: "Flotte", href: "/fleet" }, { label: "Nouveau" }]}
      />
      <form action={action} className="card p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Plaque *</label>
            <input name="plate" required className="input" placeholder="1-ABC-123" />
          </div>
          <div>
            <label className="label">VIN (numéro de série)</label>
            <input name="vin" className="input" placeholder="Optionnel" />
          </div>
          <div>
            <label className="label">Marque *</label>
            <input name="brand" required className="input" placeholder="Peugeot" />
          </div>
          <div>
            <label className="label">Modèle *</label>
            <input name="model" required className="input" placeholder="3008 HYbrid4" />
          </div>
          <div>
            <label className="label">Type *</label>
            <select name="category" required className="input" defaultValue="LEASING">
              <option value="LEASING">Leasing (contrat mensuel)</option>
              <option value="OWNED">Propriété (achat)</option>
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select name="status" className="input" defaultValue="ACTIVE">
              <option value="ACTIVE">Actif</option>
              <option value="RETURNED">Rendu</option>
              <option value="SOLD">Vendu</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </div>
          <div>
            <label className="label">Date de mise en service</label>
            <input name="commissioningDate" type="date" className="input" />
          </div>
          <div>
            <label className="label">Date de sortie (si rendu / vendu)</label>
            <input name="releaseDate" type="date" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} className="input" placeholder="Couleur, options, particularités…"/>
        </div>
        <div className="text-xs text-midnight-500 italic">
          💡 Si LEASING, tu configureras le contrat (bailleur, mensualité, dates) sur la fiche du véhicule.
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button className="btn-primary">Créer</button>
        </div>
      </form>
    </div>
  );
}
