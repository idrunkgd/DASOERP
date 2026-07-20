import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { HeartPulse, Paperclip } from "lucide-react";
import { DeleteSickLeaveButton } from "./delete-button";

export const dynamic = "force-dynamic";

/**
 * Page RH — liste centralisée des arrêts maladie de toute l'équipe.
 * Filtres : actifs (en cours aujourd'hui), à venir (futurs), passés.
 *   ?filter=active | upcoming | past   (défaut = active)
 *
 * Un consultant lambda n'a rien à faire ici (il déclare/voit ses propres
 * arrêts sur /me). L'accès est gardé par `users.manage` (rôle RH/admin).
 */
export default async function SickLeavesPage({
  searchParams
}: {
  searchParams: { filter?: string };
}) {
  await requirePermissionOrRedirect("users.manage");

  const filter = ["active", "upcoming", "past"].includes(searchParams.filter ?? "")
    ? (searchParams.filter as "active" | "upcoming" | "past")
    : "active";
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // On récupère TOUJOURS les 3 buckets (pour les compteurs) mais on n'affiche
  // qu'un seul groupe dans le tableau — c'est plus rapide qu'une query par
  // filtre et il n'y a jamais des milliers d'arrêts.
  const [allLeaves] = await Promise.all([
    prisma.sickLeave.findMany({
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: [{ startDate: "desc" }],
      take: 500
    })
  ]);
  const active   = allLeaves.filter((l) => l.startDate <= todayStart && l.endDate >= todayStart);
  const upcoming = allLeaves.filter((l) => l.startDate > todayStart);
  const past     = allLeaves.filter((l) => l.endDate < todayStart);
  const shown =
    filter === "active"   ? active   :
    filter === "upcoming" ? upcoming : past;

  return (
    <div>
      <PageHeader
        title="Arrêts maladie"
        subtitle="Consulte les arrêts déclarés par l'équipe et accède aux certificats."
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4">
        <TabLink
          href="/sick-leaves?filter=active"
          active={filter === "active"}
          count={active.length}
          label="En cours"
          tone="red"
        />
        <TabLink
          href="/sick-leaves?filter=upcoming"
          active={filter === "upcoming"}
          count={upcoming.length}
          label="À venir"
          tone="amber"
        />
        <TabLink
          href="/sick-leaves?filter=past"
          active={filter === "past"}
          count={past.length}
          label="Passés"
          tone="neutral"
        />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Consultant</th>
                <th>Début</th>
                <th>Fin</th>
                <th className="text-right">Durée</th>
                <th>Raison</th>
                <th>Certif</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-midnight-400 py-8">
                    {filter === "active"   && "Personne n'est en arrêt aujourd'hui 👍"}
                    {filter === "upcoming" && "Aucun arrêt à venir."}
                    {filter === "past"     && "Aucun arrêt passé."}
                  </td>
                </tr>
              ) : (
                shown.map((l) => {
                  const days = Math.max(
                    1,
                    Math.round(
                      (l.endDate.getTime() - l.startDate.getTime()) / (24 * 3600 * 1000)
                    ) + 1
                  );
                  const isActive = l.startDate <= todayStart && l.endDate >= todayStart;
                  return (
                    <tr key={l.id} className={isActive ? "bg-red-50/40" : ""}>
                      <td>
                        <div className="flex items-center gap-2">
                          {isActive && <HeartPulse className="w-3.5 h-3.5 text-red-600" />}
                          <span className={"font-medium " + (isActive ? "text-red-800" : "")}>
                            {l.user.firstName} {l.user.lastName}
                          </span>
                        </div>
                        <div className="text-[10px] text-midnight-400">{l.user.email}</div>
                      </td>
                      <td className="text-xs tabular-nums">
                        {l.startDate.toLocaleDateString("fr-BE")}
                      </td>
                      <td className="text-xs tabular-nums">
                        {l.endDate.toLocaleDateString("fr-BE")}
                      </td>
                      <td className="text-right tabular-nums text-xs">
                        {days} j
                      </td>
                      <td className="text-sm text-midnight-700">
                        {l.reason ?? <span className="text-midnight-400">—</span>}
                      </td>
                      <td>
                        {l.certificateUrl ? (
                          <a
                            href={l.certificateUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigoaccent hover:underline text-xs flex items-center gap-1"
                          >
                            <Paperclip className="w-3 h-3" /> voir
                          </a>
                        ) : (
                          <span className="text-[10px] text-red-600">manquant</span>
                        )}
                      </td>
                      <td>
                        <DeleteSickLeaveButton id={l.id} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabLink({
  href, active, count, label, tone
}: {
  href: string;
  active: boolean;
  count: number;
  label: string;
  tone: "red" | "amber" | "neutral";
}) {
  const toneCls =
    tone === "red"    ? (active ? "bg-red-100 text-red-800"       : "text-red-700")    :
    tone === "amber"  ? (active ? "bg-amber-100 text-amber-800"   : "text-amber-700")  :
                        (active ? "bg-midnight-100 text-midnight-800" : "text-midnight-500");
  return (
    <Link
      href={href}
      className={
        "text-sm px-3 py-1.5 rounded flex items-center gap-1.5 " +
        (active ? "font-semibold " : "hover:bg-midnight-50 ") +
        toneCls
      }
    >
      {label}
      <span className="text-[10px] bg-white/70 rounded px-1.5 py-0.5 tabular-nums">
        {count}
      </span>
    </Link>
  );
}
