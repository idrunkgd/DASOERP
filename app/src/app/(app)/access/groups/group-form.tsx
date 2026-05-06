"use client";
import { useState, useTransition } from "react";
import { createAccessGroup, updateAccessGroup } from "@/server/actions/access-groups";
import { PERMISSION_GROUPS, type Permission } from "@/lib/rbac";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Initial = {
  id?: string;
  name?: string;
  description?: string | null;
  permissions?: string[];
  isSystem?: boolean;
};

export function AccessGroupForm({ initial }: { initial?: Initial }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const [perms, setPerms] = useState<Set<string>>(new Set(initial?.permissions ?? []));
  const isSystem = initial?.isSystem ?? false;

  function toggleAll(group: { permissions: { value: Permission }[] }) {
    const next = new Set(perms);
    const allOn = group.permissions.every(p => next.has(p.value));
    for (const p of group.permissions) {
      if (allOn) next.delete(p.value);
      else next.add(p.value);
    }
    setPerms(next);
  }

  return (
    <form
      action={(fd) => start(async () => {
        try {
          // On force les permissions selon notre state
          fd.delete("permissions");
          for (const p of perms) fd.append("permissions", p);
          if (initial?.id) { await updateAccessGroup(initial.id, fd); toast.success("Groupe mis à jour"); router.refresh(); }
          else { await createAccessGroup(fd); }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 space-y-5 max-w-4xl"
    >
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5">
          <label className="label">Nom du groupe *</label>
          <input name="name" defaultValue={initial?.name ?? ""} required className="input" placeholder="ex: Administrateur, Lecture seule, Manager projet" />
        </div>
        <div className="col-span-12 md:col-span-7">
          <label className="label">Description</label>
          <input name="description" defaultValue={initial?.description ?? ""} className="input" />
        </div>
      </div>

      {isSystem && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          Ce groupe est marqué <strong>système</strong> : vous pouvez modifier ses permissions mais pas le supprimer.
        </div>
      )}

      <div>
        <label className="label">Permissions du groupe ({perms.size} sélectionnée(s))</label>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PERMISSION_GROUPS.map(g => {
            const allChecked = g.permissions.every(p => perms.has(p.value));
            const someChecked = g.permissions.some(p => perms.has(p.value));
            return (
              <fieldset key={g.label} className="border border-border rounded-lg p-3">
                <legend className="px-2 text-xs uppercase font-semibold text-midnight-500 tracking-wide flex items-center gap-2">
                  {g.label}
                  <button type="button" onClick={() => toggleAll(g)} className="text-[10px] text-indigoaccent hover:underline normal-case">
                    {allChecked ? "Tout décocher" : "Tout cocher"}
                  </button>
                </legend>
                <div className="grid grid-cols-1 gap-1">
                  {g.permissions.map(p => (
                    <label key={p.value} className="flex items-center gap-2 text-sm hover:bg-midnight-50/40 rounded px-1 py-0.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perms.has(p.value)}
                        onChange={() => {
                          const n = new Set(perms);
                          if (n.has(p.value)) n.delete(p.value); else n.add(p.value);
                          setPerms(n);
                        }}
                      />
                      <span className="text-midnight-900">{p.label}</span>
                      <code className="ml-auto text-[10px] text-midnight-400">{p.value}</code>
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => router.push("/access")} className="btn-ghost">Annuler</button>
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer le groupe"}</button>
      </div>
    </form>
  );
}
