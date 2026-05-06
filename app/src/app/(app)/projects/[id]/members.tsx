"use client";
import { useTransition } from "react";
import { addMember, removeMember } from "@/server/actions/projects";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Member = { user: { id: string; firstName: string; lastName: string }; roleLabel: string | null };

export function ProjectMembers({
  projectId, members, users
}: { projectId: string; members: Member[]; users: { id: string; firstName: string; lastName: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">Équipe projet</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {members.length === 0 && <span className="text-sm text-midnight-500">Aucun membre.</span>}
        {members.map(m => (
          <span key={m.user.id} className="badge-info">
            {m.user.firstName} {m.user.lastName}{m.roleLabel ? ` · ${m.roleLabel}` : ""}
            <button onClick={() => start(async () => { await removeMember(projectId, m.user.id); })} className="ml-1 opacity-60 hover:opacity-100">
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <form
        action={(fd) => start(async () => {
          try { await addMember(projectId, fd); toast.success("Membre ajouté"); }
          catch (e: any) { toast.error(e.message); }
        })}
        className="grid grid-cols-12 gap-2 items-end"
      >
        <select name="userId" required className="input col-span-5">
          <option value="">— Choisir un utilisateur —</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
        <input name="roleLabel" placeholder="Rôle (ex: Lead dev)" className="input col-span-5" />
        <button disabled={pending} className="btn-primary col-span-2">Ajouter</button>
      </form>
    </section>
  );
}
