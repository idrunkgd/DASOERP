"use client";
import { useState, useTransition } from "react";
import { generateTMForMonth } from "@/server/actions/tm-billing";
import { toast } from "sonner";
import { format, startOfMonth, subMonths } from "date-fns";

export function TMBillingButton({ projectId }: { projectId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const lastMonth = format(subMonths(startOfMonth(new Date()), 1), "yyyy-MM");
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">Générer tranche T&M</button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="card max-w-md w-full p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-1">Tranche T&M depuis timesheet</h2>
            <p className="text-xs text-midnight-500 mb-4">Agrège toutes les heures validées du mois sélectionné × tarif jour de l'offre source (8h/jour).</p>
            <form action={(fd) => start(async () => {
              try { await generateTMForMonth(projectId, String(fd.get("month") || lastMonth) + "-01"); setOpen(false); toast.success("Tranche T&M générée"); }
              catch (e: any) { toast.error(e.message); }
            })} className="space-y-3">
              <div>
                <label className="label">Mois à facturer</label>
                <input name="month" type="month" defaultValue={lastMonth} required className="input" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
                <button disabled={pending} className="btn-primary">{pending ? "..." : "Générer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
