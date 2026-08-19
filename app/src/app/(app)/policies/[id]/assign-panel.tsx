"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import { assignPolicy } from "@/server/actions/policies";
import { isNextControlFlow } from "@/lib/next-errors";

export function AssignPanel({
  documentId, currentVersionId, users, signedCount, pendingCount
}: {
  documentId: string;
  currentVersionId: string;
  users: Array<{ id: string; firstName: string; lastName: string; email: string }>;
  signedCount: number;
  pendingCount: number;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  function assign(all?: boolean) {
    if (!all && selected.size === 0) return;
    start(async () => {
      try {
        const r = await assignPolicy(documentId, all ? "all" : Array.from(selected));
        toast.success(`${r.assigned} assignation(s) créée(s)${r.skipped > 0 ? `, ${r.skipped} déjà assigné(s)` : ""}`);
        setSelected(new Set());
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-indigoaccent" /> Assigner
      </h3>
      <div className="text-[11px] text-midnight-500 mb-3">
        {signedCount} signé(s) · {pendingCount} en attente
      </div>
      <button
        type="button"
        onClick={() => assign(true)}
        disabled={pending}
        className="btn-primary btn-sm w-full text-xs mb-3"
      >
        <Users className="w-3.5 h-3.5" /> Assigner à tous les employés actifs
      </button>
      {users.length > 0 && (
        <>
          <p className="text-[11px] text-midnight-500 mb-2">Ou sélectionne des personnes :</p>
          <ul className="max-h-64 overflow-y-auto space-y-1 mb-3 border border-border rounded p-2">
            {users.map((u) => (
              <li key={u.id}>
                <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-indigoaccent">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                  />
                  <span>{u.firstName} {u.lastName}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => assign(false)}
            disabled={pending || selected.size === 0}
            className="btn-secondary btn-sm w-full text-xs"
          >
            Assigner à la sélection ({selected.size})
          </button>
        </>
      )}
      {users.length === 0 && (
        <p className="text-[11px] text-midnight-500 italic">
          Tous les employés actifs sont déjà assignés à cette version.
        </p>
      )}
    </div>
  );
}
