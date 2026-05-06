"use client";
import Link from "next/link";
import { useTransition } from "react";
import { deleteAccessGroup } from "@/server/actions/access-groups";
import { toast } from "sonner";
import { ShieldCheck, Lock, Trash2, Edit3 } from "lucide-react";

type Group = { id: string; name: string; description: string | null; permissionsCount: number; isSystem: boolean; usersCount: number };

export function GroupsBlock({ groups, permissionsByGroupId }: { groups: Group[]; permissionsByGroupId: Record<string, string[]> }) {
  const [pending, start] = useTransition();
  if (groups.length === 0) {
    return <div className="card p-6 text-sm text-midnight-500">Aucun groupe défini. Cliquez sur « Nouveau groupe » pour en créer.</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {groups.map(g => (
        <div key={g.id} className="card p-4 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {g.isSystem ? <Lock className="w-4 h-4 text-midnight-400 shrink-0" title="Groupe système" /> : <ShieldCheck className="w-4 h-4 text-indigoaccent shrink-0" />}
              <h3 className="font-semibold text-midnight-900 truncate">{g.name}</h3>
            </div>
            <div className="flex items-center gap-1">
              <Link href={`/access/groups/${g.id}`} className="text-midnight-500 hover:text-midnight-900" title="Modifier">
                <Edit3 className="w-4 h-4" />
              </Link>
              {!g.isSystem && (
                <button
                  disabled={pending}
                  onClick={() => { if (window.confirm(`Supprimer le groupe « ${g.name} » ?`)) start(async () => { try { await deleteAccessGroup(g.id); toast.success("Supprimé"); } catch (e: any) { toast.error(e.message); } }); }}
                  className="text-midnight-500 hover:text-danger" title="Supprimer"
                ><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          </div>
          {g.description && <p className="text-xs text-midnight-500 mb-3">{g.description}</p>}
          <div className="text-xs text-midnight-700 mb-2">
            <span className="font-medium">{g.permissionsCount}</span> permission(s) · <span className="font-medium">{g.usersCount}</span> utilisateur(s)
          </div>
          <details className="text-xs mt-auto">
            <summary className="cursor-pointer text-indigoaccent hover:underline">Voir les permissions</summary>
            <div className="mt-1 flex flex-wrap gap-1">
              {(permissionsByGroupId[g.id] ?? []).slice(0, 30).map(p => (
                <span key={p} className="badge-info text-[10px]">{p}</span>
              ))}
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}
