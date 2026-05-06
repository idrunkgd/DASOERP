"use client";
import Link from "next/link";
import { useTransition } from "react";
import { assignUserGroup } from "@/server/actions/access-groups";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ROLE_LABELS } from "@/lib/rbac";
import { toast } from "sonner";

type U = { id: string; firstName: string; lastName: string; email: string; role: string; photoUrl: string | null; accessGroupId: string | null; accessGroupName: string | null; overridesCount: number };
type G = { id: string; name: string; isSystem: boolean };

export function UserAssignmentTable({ users, groups }: { users: U[]; groups: G[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="card overflow-x-auto">
      <table className="table-base">
        <thead><tr>
          <th>Utilisateur</th>
          <th>Rôle (fonction)</th>
          <th>Groupe d'accès</th>
          <th className="text-right">Surcharges</th>
          <th></th>
        </tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>
                <div className="flex items-center gap-2">
                  <PersonAvatar firstName={u.firstName} lastName={u.lastName} photoUrl={u.photoUrl} size={28} />
                  <div className="min-w-0">
                    <div className="font-medium text-midnight-900 truncate">{u.firstName} {u.lastName}</div>
                    <div className="text-[11px] text-midnight-500 truncate">{u.email}</div>
                  </div>
                </div>
              </td>
              <td className="text-midnight-700">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</td>
              <td>
                <select
                  defaultValue={u.accessGroupId ?? ""}
                  disabled={pending}
                  onChange={(e) => {
                    const v = e.target.value;
                    start(async () => { try { await assignUserGroup(u.id, v); toast.success("Groupe attribué"); } catch (err: any) { toast.error(err.message); e.target.value = u.accessGroupId ?? ""; } });
                  }}
                  className="input h-8 text-sm py-0 w-[260px]"
                >
                  <option value="">— Aucun (défaut du rôle) —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}{g.isSystem ? " (système)" : ""}</option>)}
                </select>
              </td>
              <td className="text-right tabular-nums">
                {u.overridesCount > 0
                  ? <span className="badge-warning">{u.overridesCount}</span>
                  : <span className="text-midnight-400 text-xs">—</span>}
              </td>
              <td className="text-right">
                <Link href={`/access/overrides?user=${u.id}`} className="text-xs text-indigoaccent hover:underline">Affiner →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
