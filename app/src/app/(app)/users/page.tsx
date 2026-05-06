import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePermission, ROLE_LABELS } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { Plus } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePermission("users.manage");
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { lastName: "asc" }],
    include: { accessGroup: { select: { name: true } } }
  });
  return (
    <div>
      <PageHeader title="Utilisateurs" subtitle={`${users.length} compte(s) — le rôle est une fonction métier, les droits viennent du groupe d'accès`}
        actions={<Link href="/users/new" className="btn-primary"><Plus className="w-4 h-4" /> Nouveau</Link>} />
      <div className="card overflow-hidden">
        <table className="table-base">
          <thead><tr><th>Nom</th><th>Email</th><th>Rôle (fonction)</th><th>Groupe d'accès</th><th className="text-right">Taux/h</th><th className="text-right">Capacité</th><th>Actif</th><th>Entrée</th></tr></thead>
          <tbody>
            {users.map(u => {
              const groupName = u.accessGroup?.name ?? "Visiteur";
              const isVisitor = !u.accessGroup;
              return (
                <tr key={u.id} className={!u.active ? "opacity-50" : ""}>
                  <td><Link href={`/users/${u.id}`} className="font-medium hover:underline">{u.firstName} {u.lastName}</Link></td>
                  <td className="text-midnight-700">{u.email}</td>
                  <td><span className="badge-neutral">{ROLE_LABELS[u.role]}</span></td>
                  <td><span className={isVisitor ? "badge-warning" : "badge-info"}>{groupName}</span></td>
                  <td className="text-right tabular-nums">{u.hourlyCost ? formatCurrency(u.hourlyCost) : "—"}</td>
                  <td className="text-right tabular-nums">{Number(u.weeklyCapacityH).toFixed(0)}h</td>
                  <td>{u.active ? <span className="badge-success">Actif</span> : <span className="badge-neutral">Inactif</span>}</td>
                  <td className="text-midnight-500 text-xs">{u.joinedAt ? formatDate(u.joinedAt) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
