"use client";
import { useTransition } from "react";
import { approveEntry, rejectEntry } from "@/server/actions/timesheets";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";

type Item = { id: string; hours: number; date: string; activityType: string; description: string | null; userName: string; projectRef: string; projectName: string };

export function ValidationList({ entries }: { entries: Item[] }) {
  const [pending, start] = useTransition();
  if (entries.length === 0) return <EmptyState title="Rien à valider" description="Toutes les entrées sont à jour." />;
  return (
    <div className="card overflow-hidden">
      <table className="table-base">
        <thead><tr><th>Date</th><th>Utilisateur</th><th>Projet</th><th>Activité</th><th className="text-right">Heures</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id}>
              <td>{e.date}</td>
              <td className="font-medium">{e.userName}</td>
              <td>{e.projectRef} — {e.projectName}</td>
              <td className="text-xs">{e.activityType}</td>
              <td className="text-right tabular-nums">{e.hours.toFixed(2)}</td>
              <td className="text-midnight-700 text-xs max-w-xs truncate">{e.description ?? ""}</td>
              <td className="text-right whitespace-nowrap">
                <button
                  disabled={pending}
                  onClick={() => start(async () => { try { await approveEntry(e.id); toast.success("Validé"); } catch (err: any) { toast.error(err.message); } })}
                  className="btn-primary btn-sm mr-1">Valider</button>
                <button
                  disabled={pending}
                  onClick={() => {
                    const note = window.prompt("Motif du refus :") || "";
                    if (!note) return;
                    start(async () => { await rejectEntry(e.id, note); toast.success("Refusé"); });
                  }}
                  className="btn-danger btn-sm">Refuser</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
