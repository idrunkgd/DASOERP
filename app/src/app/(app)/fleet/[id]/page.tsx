import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Car, User as UserIcon, Trash2 } from "lucide-react";
import { ContractForm } from "./contract-form";
import { AssignForm, UnassignButton } from "./assign-form";
import { DeleteVehicleButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({ params }: { params: { id: string } }) {
  const session = await requirePermissionOrRedirect("fleet.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canManage = perms.includes("fleet.manage");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: {
      leasingContract: true,
      assignments: {
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        orderBy: { startDate: "desc" }
      }
    }
  });
  if (!vehicle) notFound();

  const activeAssignment = vehicle.assignments.find((a) => a.endDate === null);
  const users = canManage
    ? await prisma.user.findMany({
        where: { active: true, candidateProfile: { is: null } },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }]
      })
    : [];

  return (
    <div>
      <PageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={`${vehicle.plate} · ${vehicle.category === "LEASING" ? "Leasing" : "Propriété"}`}
        breadcrumb={[{ label: "Flotte", href: "/fleet" }, { label: vehicle.plate }]}
        actions={
          canManage && (
            <DeleteVehicleButton id={vehicle.id} plate={vehicle.plate} />
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Colonne gauche : infos + contrat */}
        <div className="lg:col-span-2 space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold text-midnight-900 mb-3 flex items-center gap-2">
              <Car className="w-4 h-4 text-indigoaccent" /> Fiche véhicule
            </h2>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs text-midnight-500">Plaque</dt>
                <dd className="font-mono font-semibold">{vehicle.plate}</dd>
              </div>
              <div>
                <dt className="text-xs text-midnight-500">Marque / modèle</dt>
                <dd>{vehicle.brand} {vehicle.model}</dd>
              </div>
              {vehicle.vin && (
                <div>
                  <dt className="text-xs text-midnight-500">VIN</dt>
                  <dd className="font-mono text-xs">{vehicle.vin}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-midnight-500">Type</dt>
                <dd>{vehicle.category === "LEASING" ? "Leasing" : "Propriété"}</dd>
              </div>
              <div>
                <dt className="text-xs text-midnight-500">Statut</dt>
                <dd>{vehicle.status}</dd>
              </div>
              {vehicle.commissioningDate && (
                <div>
                  <dt className="text-xs text-midnight-500">Mise en service</dt>
                  <dd>{vehicle.commissioningDate.toLocaleDateString("fr-BE")}</dd>
                </div>
              )}
              {vehicle.releaseDate && (
                <div>
                  <dt className="text-xs text-midnight-500">Sortie</dt>
                  <dd>{vehicle.releaseDate.toLocaleDateString("fr-BE")}</dd>
                </div>
              )}
            </dl>
            {vehicle.notes && (
              <div className="mt-3 text-sm text-midnight-700 border-t border-border pt-3">
                {vehicle.notes}
              </div>
            )}
          </section>

          {vehicle.category === "LEASING" && (
            <section className="card p-5">
              <h2 className="font-semibold text-midnight-900 mb-3">Contrat de leasing</h2>
              {canManage ? (
                <ContractForm
                  vehicleId={vehicle.id}
                  initial={vehicle.leasingContract ? {
                    lessor: vehicle.leasingContract.lessor,
                    contractRef: vehicle.leasingContract.contractRef,
                    startDate: vehicle.leasingContract.startDate.toISOString().slice(0, 10),
                    endDate: vehicle.leasingContract.endDate.toISOString().slice(0, 10),
                    monthlyAmount: Number(vehicle.leasingContract.monthlyAmount),
                    kmIncludedYear: vehicle.leasingContract.kmIncludedYear,
                    notes: vehicle.leasingContract.notes
                  } : null}
                />
              ) : vehicle.leasingContract ? (
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-midnight-500">Bailleur</dt>
                    <dd className="font-medium">{vehicle.leasingContract.lessor}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-midnight-500">Mensualité TVAC</dt>
                    <dd className="font-semibold text-indigoaccent">
                      {Number(vehicle.leasingContract.monthlyAmount).toFixed(2)} €
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-midnight-500">Fin de contrat</dt>
                    <dd>{vehicle.leasingContract.endDate.toLocaleDateString("fr-BE")}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-midnight-500 italic">Aucun contrat renseigné.</p>
              )}
            </section>
          )}
        </div>

        {/* Colonne droite : attribution + historique */}
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold text-midnight-900 mb-3 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-indigoaccent" /> Attribution
            </h2>
            {activeAssignment ? (
              <div>
                <div className="text-sm font-medium text-midnight-900">
                  {activeAssignment.user.firstName} {activeAssignment.user.lastName}
                </div>
                <div className="text-xs text-midnight-500">
                  Depuis le {activeAssignment.startDate.toLocaleDateString("fr-BE")}
                  {activeAssignment.startKm ? ` · ${activeAssignment.startKm.toLocaleString("fr-BE")} km au départ` : ""}
                </div>
                {canManage && (
                  <div className="mt-3">
                    <UnassignButton vehicleId={vehicle.id} />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-midnight-500 italic mb-3">Aucune attribution active.</p>
                {canManage && users.length > 0 && (
                  <AssignForm vehicleId={vehicle.id} users={users} />
                )}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-midnight-900 mb-3">Historique</h2>
            {vehicle.assignments.length === 0 ? (
              <p className="text-sm text-midnight-500 italic">Aucun historique.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {vehicle.assignments.map((a) => (
                  <li key={a.id} className="border-l-2 border-indigoaccent pl-2">
                    <div className="font-medium">
                      <Link href={`/users/${a.user.id}`} className="hover:text-indigoaccent">
                        {a.user.firstName} {a.user.lastName}
                      </Link>
                    </div>
                    <div className="text-midnight-500">
                      {a.startDate.toLocaleDateString("fr-BE")}
                      {a.endDate ? ` → ${a.endDate.toLocaleDateString("fr-BE")}` : " → aujourd'hui"}
                    </div>
                    {(a.startKm || a.endKm) && (
                      <div className="text-midnight-400 text-[10px]">
                        {a.startKm && `${a.startKm.toLocaleString("fr-BE")} km`}
                        {a.endKm && ` → ${a.endKm.toLocaleString("fr-BE")} km`}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
