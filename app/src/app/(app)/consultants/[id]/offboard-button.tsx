"use client";
import { useState, useTransition } from "react";
import { offboardConsultantAction } from "@/server/actions/recruitment";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export function OffboardButton({ userId, fullName }: { userId: string; fullName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-danger btn-sm flex items-center gap-1">
        <LogOut className="w-3 h-3" /> Marquer comme parti
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="card max-w-md w-full p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-1">Départ de {fullName}</h2>
            <p className="text-xs text-midnight-500 mb-4">Le compte sera désactivé (impossible de se connecter), la date de sortie sera fixée à aujourd'hui.</p>
            <form
              action={(fd) => start(async () => {
                try { await offboardConsultantAction(userId, fd); toast.success("Départ enregistré"); setOpen(false); }
                catch (e: any) { toast.error(e.message); }
              })}
              className="space-y-3"
            >
              <div>
                <label className="label">Raison (optionnel)</label>
                <input name="reason" placeholder="ex: nouvelle opportunité, fin de contrat..." className="input" />
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="keepInPool" value="true" className="mt-1" />
                <span>
                  <span className="font-medium">Conserver dans le vivier candidats</span>
                  <span className="block text-xs text-midnight-500">Recrée un Candidat ACTIF pour pouvoir le re-présenter ultérieurement (ou rouvre celui d'origine).</span>
                </span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
                <button disabled={pending} className="btn-danger">{pending ? "..." : "Confirmer le départ"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
