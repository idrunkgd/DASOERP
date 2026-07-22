import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermissionOrRedirect, getUserEffectivePermissions } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Plane, CheckCircle2 } from "lucide-react";
import { ApproveActions } from "./approve-actions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: "Brouillon",  cls: "bg-midnight-100 text-midnight-700" },
  SUBMITTED: { label: "En attente", cls: "bg-amber-100 text-amber-700" },
  APPROVED:  { label: "Approuvé",   cls: "bg-emerald-100 text-emerald-700" },
  REJECTED:  { label: "Refusé",     cls: "bg-red-100 text-red-700" },
  CANCELLED: { label: "Annulé",     cls: "bg-midnight-100 text-midnight-500" }
};
const TYPE_LABELS: Record<string, string> = {
  ANNUAL: "Congé payé", RTT: "RTT", UNPAID: "Sans solde",
  SPECIAL: "Spécial", OTHER: "Autre"
};

export default async function LeavesPage({
  searchParams
}: {
  searchParams: { filter?: string };
}) {
  const session = await requirePermissionOrRedirect("leaves.read");
  const perms = await getUserEffectivePermissions(session.user.id, session.user.role);
  const canApprove = perms.includes("leaves.approve");

  // Filtre : à approuver / actifs / historique — défaut = à approuver si
  // manager, sinon actifs (utile pour un consultant qui veut voir sa liste).
  const filter = ["pending", "active", "history"].includes(searchParams.filter ?? "")
    ? (searchParams.filter as "pending" | "active" | "history")
    : (canApprove ? "pending" : "active");

  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const requests = await prisma.leaveRequest.findMany({
    where: canApprove ? {} : { userId: session.user.id },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      mission: { select: { reference: true, title: true } }
    },
    orderBy: { startDate: "desc" },
    take: 500
  });
  const pending = requests.filter((r) => r.status === "SUBMITTED");
  const active  = requests.filter((r) => r.status === "APPROVED"
    && r.startDate <= todayStart && r.endDate >= todayStart);
  const history = requests.filter((r) => ["APPROVED", "REJECTED", "CANCELLED"].includes(r.status)
    && !(r.status === "APPROVED" && r.startDate <= todayStart && r.endDate >= todayStart));
  const shown =
    filter === "pending" ? pending :
    filter === "active"  ? active  : history;

  return (
    <div>
      <PageHeader
        title="Congés"
        subtitle={canApprove
          ? "Consulter et approuver les demandes de l'équipe."
          : "Vos demandes de congés."}
      />

      <div className="flex items-center gap-1 mb-4">
        <TabLink
          href="/leaves?filter=pending"
          active={filter === "pending"}
          count={pending.length}
          label="À approuver"
          tone="amber"
        />
        <TabLink
          href="/leaves?filter=active"
          active={filter === "active"}
          count={active.length}
          label="En cours"
          tone="emerald"
        />
        <TabLink
          href="/leaves?filter=history"
          active={filter === "history"}
          count={history.length}
          label="Historique"
          tone="neutral"
        />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Consultant</th>
                <th>Type</th>
                <th>Début</th>
                <th>Fin</th>
                <th className="text-right">Jours</th>
                <th>Rattachement</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-midnight-400 py-8">
                    {filter === "pending" && "Aucune demande en attente 👌"}
                    {filter === "active"  && "Personne en congé actuellement."}
                    {filter === "history" && "Aucun historique."}
                  </td>
                </tr>
              ) : shown.map((l) => {
                const st = STATUS_LABELS[l.status];
                return (
                  <tr key={l.id}>
                    <td>
                      <div className="font-medium">{l.user.firstName} {l.user.lastName}</div>
                      <div className="text-[10px] text-midnight-400">{l.user.email}</div>
                    </td>
                    <td className="text-xs">{TYPE_LABELS[l.type] ?? l.type}</td>
                    <td className="text-xs tabular-nums">{l.startDate.toLocaleDateString("fr-BE")}</td>
                    <td className="text-xs tabular-nums">{l.endDate.toLocaleDateString("fr-BE")}</td>
                    <td className="text-right tabular-nums text-xs font-medium">{Number(l.days)}j</td>
                    <td className="text-xs">
                      {l.mission ? (
                        <>
                          <div>{l.mission.reference}</div>
                          <div className="text-midnight-400 truncate">{l.mission.title}</div>
                          {l.clientApproved && (
                            <div className="text-[10px] text-emerald-700 flex items-center gap-0.5 mt-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5" /> client OK
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-midnight-400">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`text-[10px] rounded px-1.5 py-0.5 ${st?.cls ?? ""}`}>
                        {st?.label ?? l.status}
                      </span>
                      {l.rejectionReason && (
                        <div className="text-[10px] text-red-600 mt-0.5 truncate max-w-[160px]">
                          {l.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td>
                      {canApprove && l.status === "SUBMITTED" && (
                        <ApproveActions id={l.id} />
                      )}
                    </td>
                  </tr>
                );
              })}
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
  href: string; active: boolean; count: number; label: string;
  tone: "amber" | "emerald" | "neutral";
}) {
  const cls =
    tone === "amber"   ? (active ? "bg-amber-100 text-amber-800"     : "text-amber-700")   :
    tone === "emerald" ? (active ? "bg-emerald-100 text-emerald-800" : "text-emerald-700") :
                         (active ? "bg-midnight-100 text-midnight-800" : "text-midnight-500");
  return (
    <Link
      href={href}
      className={
        "text-sm px-3 py-1.5 rounded flex items-center gap-1.5 " +
        (active ? "font-semibold " : "hover:bg-midnight-50 ") + cls
      }
    >
      {label}
      <span className="text-[10px] bg-white/70 rounded px-1.5 py-0.5 tabular-nums">{count}</span>
    </Link>
  );
}
