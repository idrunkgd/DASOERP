"use client";
import { useState, useTransition } from "react";
import { setPermissionOverride, resetUserOverrides } from "@/server/actions/access";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { ROLE_LABELS, type Permission } from "@/lib/rbac";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

type Cell = { effective: boolean; default: boolean; override: "GRANT" | "REVOKE" | null };
type Row = {
  id: string; firstName: string; lastName: string; email: string;
  role: string; photoUrl: string | null;
  groupName?: string | null;
  cells: Record<string, Cell>;
  hasOverrides: boolean;
};
type Group = { label: string; permissions: { value: Permission; label: string }[] };

export function AccessMatrix({ matrix, groups }: { matrix: Row[]; groups: Group[] }) {
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");

  const filtered = filter
    ? matrix.filter(r =>
        (r.firstName + " " + r.lastName + " " + r.email).toLowerCase().includes(filter.toLowerCase())
      )
    : matrix;

  // Cycle Hérité → Accordé → Refusé → Hérité
  function nextState(c: Cell): "GRANT" | "REVOKE" | "INHERIT" {
    if (c.override === null) return "GRANT";
    if (c.override === "GRANT") return "REVOKE";
    return "INHERIT";
  }

  function toggle(userId: string, permission: string, c: Cell) {
    const next = nextState(c);
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("permission", permission);
    fd.set("granted", next);
    start(async () => {
      try { await setPermissionOverride(fd); toast.success("Accès mis à jour"); }
      catch (e: any) { toast.error(e.message); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer un utilisateur..."
          className="input max-w-xs"
        />
        <span className="text-xs text-midnight-500">{filtered.length} affiché(s)</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0">
          <thead className="sticky top-0 bg-white z-10">
            <tr>
              <th rowSpan={2} className="text-left px-3 py-2 border-b border-border min-w-[220px] sticky left-0 bg-white z-20">Utilisateur</th>
              {groups.map(g => (
                <th key={g.label} colSpan={g.permissions.length} className="text-center px-2 py-1 border-b border-l border-border bg-midnight-50/50 font-semibold text-midnight-700 uppercase text-[10px] tracking-wide">{g.label}</th>
              ))}
              <th rowSpan={2} className="text-center px-2 py-2 border-b border-l border-border w-12">↺</th>
            </tr>
            <tr>
              {groups.flatMap(g => g.permissions.map((p, idx) => (
                <th
                  key={p.value}
                  className={cn(
                    "px-1 py-2 border-b border-border text-[10px] font-normal text-midnight-700 align-bottom",
                    idx === 0 && "border-l"
                  )}
                  style={{ height: 110, verticalAlign: "bottom" }}
                >
                  <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap" }}>{p.label}</div>
                </th>
              )))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-midnight-50/30">
                <td className="px-3 py-2 border-b border-border/40 sticky left-0 bg-white">
                  <div className="flex items-center gap-2">
                    <PersonAvatar firstName={r.firstName} lastName={r.lastName} photoUrl={r.photoUrl} size={28} />
                    <div className="min-w-0">
                      <div className="font-medium text-midnight-900 truncate">{r.firstName} {r.lastName}</div>
                      <div className="text-[11px] text-midnight-500 truncate">
                        {ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] ?? r.role}
                        {r.groupName && <span className="text-indigoaccent"> · {r.groupName}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                {groups.flatMap(g => g.permissions.map((p, idx) => {
                  const c = r.cells[p.value];
                  const tooltip =
                    c.override === "GRANT" ? `Accordé (override)` :
                    c.override === "REVOKE" ? `Refusé (override)` :
                    `Hérité du rôle (${c.default ? "✓" : "✗"})`;
                  return (
                    <td
                      key={p.value}
                      className={cn(
                        "border-b border-border/40 text-center align-middle p-0",
                        idx === 0 && "border-l"
                      )}
                    >
                      <button
                        onClick={() => toggle(r.id, p.value, c)}
                        disabled={pending}
                        title={tooltip}
                        className={cn(
                          "w-full h-9 grid place-items-center text-xs font-medium transition-colors",
                          c.override === "GRANT"  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" :
                          c.override === "REVOKE" ? "bg-red-100 text-red-800 hover:bg-red-200" :
                          c.effective             ? "bg-midnight-50/40 text-midnight-700 hover:bg-midnight-100" :
                                                    "bg-white text-midnight-300 hover:bg-midnight-50"
                        )}
                      >
                        {c.override === "GRANT" ? "+" : c.override === "REVOKE" ? "−" : c.effective ? "✓" : "·"}
                      </button>
                    </td>
                  );
                }))}
                <td className="border-b border-l border-border/40 text-center">
                  {r.hasOverrides && (
                    <button
                      onClick={() => { if (window.confirm("Réinitialiser tous les overrides de cet utilisateur ?")) start(async () => { await resetUserOverrides(r.id); toast.success("Réinitialisé"); }); }}
                      title="Tout réinitialiser au défaut du rôle"
                      className="text-midnight-500 hover:text-midnight-900"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-midnight-700">
        <span className="font-medium">Légende :</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 bg-midnight-50/40 border border-border" /> Hérité du rôle (✓ accordé / · refusé)</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 bg-emerald-100 border border-emerald-300 text-emerald-800 grid place-items-center font-bold">+</span> Accordé en surcharge</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-4 bg-red-100 border border-red-300 text-red-800 grid place-items-center font-bold">−</span> Refusé en surcharge</span>
        <span className="text-midnight-500">— Click = Hérité → Accordé → Refusé → Hérité</span>
      </div>
    </div>
  );
}
