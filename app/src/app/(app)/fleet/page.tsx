import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Car, Plus, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  ACTIVE:   { label: "Actif",    cls: "bg-emerald-100 text-emerald-800" },
  RETURNED: { label: "Rendu",    cls: "bg-midnight-100 text-midnight-700" },
  SOLD:     { label: "Vendu",    cls: "bg-blue-100 text-blue-800" },
  ARCHIVED: { label: "Archivé",  cls: "bg-midnight-50 text-midnight-500" }
};

export default async function FleetPage() {
  await requirePermissionOrRedirect("fleet.read");
  const vehicles = await prisma.vehicle.findMany({
    orderBy: [{ status: "asc" }, { plate: "asc" }],
    include: {
      leasingContract: { select: { lessor: true, endDate: true, monthlyAmount: true } },
      assignments: {
        where: { endDate: null },
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        take: 1
      }
    }
  });

  const active = vehicles.filter((v) => v.status === "ACTIVE");
  const others = vehicles.filter((v) => v.status !== "ACTIVE");

  return (
    <div>
      <PageHeader
        title="Flotte"
        subtitle={`${active.length} véhicule${active.length > 1 ? "s" : ""} en circulation`}
        actions={
          <Link href="/fleet/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Nouveau véhicule
          </Link>
        }
      />

      {active.length === 0 ? (
        <div className="card p-12 text-center">
          <Car className="w-10 h-10 mx-auto text-midnight-300 mb-3" />
          <p className="text-midnight-500 text-sm">Aucun véhicule dans la flotte.</p>
          <Link href="/fleet/new" className="btn-primary mt-4 inline-flex">
            <Plus className="w-4 h-4" /> Ajouter le premier
          </Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Plaque</th>
                <th>Véhicule</th>
                <th>Type</th>
                <th>Utilisateur actuel</th>
                <th>Leasing</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {active.map((v) => (
                <tr key={v.id}>
                  <td className="font-mono font-semibold">{v.plate}</td>
                  <td>
                    <div className="font-medium">{v.brand} {v.model}</div>
                    {v.vin && <div className="text-[10px] text-midnight-400 font-mono">{v.vin}</div>}
                  </td>
                  <td>
                    <span className={"text-[11px] rounded px-1.5 py-0.5 " +
                      (v.category === "LEASING" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800")}>
                      {v.category === "LEASING" ? "Leasing" : "Propriété"}
                    </span>
                  </td>
                  <td>
                    {v.assignments[0]?.user ? (
                      <span className="text-sm">
                        {v.assignments[0].user.firstName} {v.assignments[0].user.lastName}
                      </span>
                    ) : (
                      <span className="text-xs text-midnight-400">— (non attribué)</span>
                    )}
                  </td>
                  <td>
                    {v.leasingContract ? (
                      <div className="text-xs">
                        <div>{v.leasingContract.lessor}</div>
                        <div className="text-midnight-500">
                          {Number(v.leasingContract.monthlyAmount).toFixed(0)} €/mois
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-midnight-400">—</span>
                    )}
                  </td>
                  <td>
                    <span className={"text-[10px] rounded px-1.5 py-0.5 " + STATUS_LABELS[v.status].cls}>
                      {STATUS_LABELS[v.status].label}
                    </span>
                  </td>
                  <td>
                    <Link href={`/fleet/${v.id}`} className="text-indigoaccent hover:text-indigo-700">
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {others.length > 0 && (
        <details className="mt-6 card p-4">
          <summary className="cursor-pointer text-sm font-medium text-midnight-600">
            Sortis de flotte ({others.length})
          </summary>
          <ul className="mt-3 space-y-1 text-sm">
            {others.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-1">
                <Link href={`/fleet/${v.id}`} className="text-midnight-700 hover:text-indigoaccent">
                  <span className="font-mono font-semibold">{v.plate}</span>
                  &nbsp;· {v.brand} {v.model}
                </Link>
                <span className={"text-[10px] rounded px-1.5 py-0.5 " + STATUS_LABELS[v.status].cls}>
                  {STATUS_LABELS[v.status].label}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
