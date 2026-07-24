import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { updateVehicle } from "@/server/actions/fleet";
import { PhotoInput } from "../../new/photo-input";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({ params }: { params: { id: string } }) {
  await requirePermissionOrRedirect("fleet.manage");

  const vehicle = await prisma.vehicle.findUnique({ where: { id: params.id } });
  if (!vehicle) notFound();

  async function action(fd: FormData) {
    "use server";
    await updateVehicle(params.id, fd);
    redirect(`/fleet/${params.id}`);
  }

  const toIso = (d: Date | null | undefined) =>
    d ? d.toISOString().slice(0, 10) : "";

  return (
    <div>
      <PageHeader
        title={`Modifier ${vehicle.brand} ${vehicle.model}`}
        subtitle={vehicle.plate}
        breadcrumb={[
          { label: "Flotte", href: "/fleet" },
          { label: vehicle.plate, href: `/fleet/${vehicle.id}` },
          { label: "Modifier" }
        ]}
      />
      <form action={action} className="card p-6 max-w-3xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Plaque *</label>
            <input name="plate" required defaultValue={vehicle.plate} className="input" />
          </div>
          <div>
            <label className="label">VIN (numéro de série)</label>
            <input name="vin" defaultValue={vehicle.vin ?? ""} className="input" placeholder="Optionnel" />
          </div>
          <div>
            <label className="label">Marque *</label>
            <input name="brand" required defaultValue={vehicle.brand} className="input" />
          </div>
          <div>
            <label className="label">Modèle *</label>
            <input name="model" required defaultValue={vehicle.model} className="input" />
          </div>
          <div>
            <label className="label">Type *</label>
            <select name="category" required defaultValue={vehicle.category} className="input">
              <option value="LEASING">Leasing (contrat mensuel)</option>
              <option value="OWNED">Propriété (achat)</option>
            </select>
          </div>
          <div>
            <label className="label">Statut</label>
            <select name="status" defaultValue={vehicle.status} className="input">
              <option value="ACTIVE">Actif</option>
              <option value="RETURNED">Rendu</option>
              <option value="SOLD">Vendu</option>
              <option value="ARCHIVED">Archivé</option>
            </select>
          </div>
          <div>
            <label className="label">Date de mise en service</label>
            <input name="commissioningDate" type="date" defaultValue={toIso(vehicle.commissioningDate)} className="input" />
          </div>
          <div>
            <label className="label">Date de sortie (si rendu / vendu)</label>
            <input name="releaseDate" type="date" defaultValue={toIso(vehicle.releaseDate)} className="input" />
          </div>
        </div>

        <PhotoInput initial={vehicle.photoUrl} />

        <div>
          <label className="label">Notes</label>
          <textarea name="notes" rows={2} defaultValue={vehicle.notes ?? ""} className="input" placeholder="Couleur, options, particularités…" />
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <a href={`/fleet/${vehicle.id}`} className="btn-ghost">Annuler</a>
          <button className="btn-primary">Enregistrer les modifications</button>
        </div>
      </form>
    </div>
  );
}
