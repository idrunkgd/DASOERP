import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/utils";
import { BadgeFormButton, RowActions } from "./client";
import { CreditCard, Zap, KeyRound, Fuel, ParkingSquare, MoreHorizontal, Car, User as UserIcon } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_META: Record<string, { label: string; icon: any; tone: string }> = {
  ACCESS_BADGE:  { label: "Badge d'accès",      icon: KeyRound,       tone: "bg-indigo-100 text-indigo-800" },
  RECHARGE_CARD: { label: "Carte de recharge",  icon: Zap,            tone: "bg-emerald-100 text-emerald-800" },
  TOLL_TAG:      { label: "Télépéage",          icon: CreditCard,     tone: "bg-blue-100 text-blue-800" },
  FUEL_CARD:     { label: "Carte carburant",    icon: Fuel,           tone: "bg-amber-100 text-amber-800" },
  PARKING_CARD:  { label: "Parking",            icon: ParkingSquare,  tone: "bg-violet-100 text-violet-800" },
  OTHER:         { label: "Autre",              icon: MoreHorizontal, tone: "bg-midnight-100 text-midnight-800" }
};

export default async function FleetBadgesPage({ searchParams }: { searchParams: { type?: string; userId?: string; vehicleId?: string; showArchived?: string } }) {
  await requirePermissionOrRedirect("fleet.manage");

  const where: any = {};
  if (searchParams.type && searchParams.type !== "ALL") where.type = searchParams.type;
  if (searchParams.userId) where.assignedUserId = searchParams.userId;
  if (searchParams.vehicleId) where.assignedVehicleId = searchParams.vehicleId;
  if (searchParams.showArchived !== "1") where.active = true;

  const [badges, users, vehicles] = await Promise.all([
    prisma.fleetBadge.findMany({
      where,
      include: {
        assignedUser:    { select: { id: true, firstName: true, lastName: true } },
        assignedVehicle: { select: { id: true, plate: true, brand: true, model: true } }
      },
      orderBy: [{ type: "asc" }, { label: "asc" }]
    }),
    prisma.user.findMany({
      where: { active: true, candidateProfile: { is: null } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }]
    }),
    prisma.vehicle.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, plate: true, brand: true, model: true },
      orderBy: { plate: "asc" }
    })
  ]);

  // Compteurs par type pour les filtres
  const counts: Record<string, number> = {};
  for (const b of badges) counts[b.type] = (counts[b.type] || 0) + 1;

  return (
    <div>
      <PageHeader
        pill="FLOTTE · BADGES & CARTES"
        title="Badges & cartes"
        subtitle={`${badges.length} en circulation · attribution aux consultants et/ou véhicules`}
        actions={
          <div className="flex gap-2">
            <Link href="/fleet" className="btn-ghost text-sm">← Retour flotte</Link>
            <BadgeFormButton users={users} vehicles={vehicles} />
          </div>
        }
      />

      {/* Filtres */}
      <div className="mb-4 flex items-center gap-1 flex-wrap">
        <FilterChip href="/fleet/badges" active={!searchParams.type || searchParams.type === "ALL"} label={`Tous · ${badges.length}`} />
        {Object.entries(TYPE_META).map(([type, meta]) => (
          <FilterChip
            key={type}
            href={`/fleet/badges?type=${type}`}
            active={searchParams.type === type}
            label={`${meta.label} · ${counts[type] ?? 0}`}
          />
        ))}
      </div>

      {badges.length === 0 ? (
        <div className="card p-10 text-center text-sm text-midnight-500 italic">
          Aucun badge/carte pour ces critères. Cliquez sur "+ Nouveau" pour en ajouter un.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Type</th>
                <th>Libellé</th>
                <th>Identifiant</th>
                <th>Fournisseur</th>
                <th>Attribué à</th>
                <th>Véhicule</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {badges.map((b) => {
                const meta = TYPE_META[b.type] ?? TYPE_META.OTHER;
                const Icon = meta.icon;
                return (
                  <tr key={b.id}>
                    <td>
                      <span className={"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium " + meta.tone}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    <td className="font-medium text-midnight-900">{b.label}</td>
                    <td className="font-mono text-xs text-midnight-500">{b.identifier ?? "—"}</td>
                    <td className="text-xs text-midnight-500">{b.provider ?? "—"}</td>
                    <td>
                      {b.assignedUser ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <UserIcon className="w-3 h-3 text-indigoaccent" />
                          {b.assignedUser.firstName} {b.assignedUser.lastName}
                        </span>
                      ) : (
                        <span className="text-xs text-midnight-400 italic">— stock</span>
                      )}
                    </td>
                    <td>
                      {b.assignedVehicle ? (
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Car className="w-3 h-3 text-emerald-700" />
                          <span className="font-mono">{b.assignedVehicle.plate}</span>
                          <span className="text-midnight-400">· {b.assignedVehicle.brand} {b.assignedVehicle.model}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-midnight-400 italic">—</span>
                      )}
                    </td>
                    <td className="text-xs text-midnight-500 max-w-[280px] truncate" title={b.notes ?? undefined}>
                      {b.notes ?? "—"}
                    </td>
                    <td className="text-right">
                      <RowActions badge={b as any} users={users} vehicles={vehicles} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        "text-xs px-3 py-1.5 rounded-full font-medium transition-colors " +
        (active ? "bg-indigoaccent text-white" : "bg-white text-midnight-700 hover:bg-indigoaccent/10 border border-border")
      }
    >
      {label}
    </Link>
  );
}
