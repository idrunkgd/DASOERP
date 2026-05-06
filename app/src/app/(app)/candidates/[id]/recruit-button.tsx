"use client";
import { useState, useTransition } from "react";
import { promoteCandidateAction } from "@/server/actions/recruitment";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

function suggestPassword() {
  const r = Math.random().toString(36).slice(-6);
  return `Dasolabs!${r}`;
}

export function RecruitButton({ candidateId, suggestedEmail }: { candidateId: string; suggestedEmail: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [pwd, setPwd] = useState(suggestPassword());
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary btn-sm flex items-center gap-1">
        <UserCheck className="w-3 h-3" /> Recruter en consultant
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="card max-w-md w-full p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-1">Promotion en consultant Dasolabs</h2>
            <p className="text-xs text-midnight-500 mb-4">
              Crée un compte utilisateur (rôle Consultant par défaut), copie le profil (photo, compétences, taux), et archive le candidat.
              Communiquez le mot de passe initial hors-bande, l'utilisateur le changera à la première connexion.
            </p>
            <form
              action={(fd) => start(async () => {
                try { await promoteCandidateAction(candidateId, fd); toast.success("Recrutement effectué"); setOpen(false); }
                catch (e: any) { toast.error(e.message); }
              })}
              className="space-y-3"
            >
              <div>
                <label className="label">Email pro Dasolabs *</label>
                <input name="email" type="email" defaultValue={suggestedEmail} required className="input" placeholder="prenom.nom@dasolabs.com" />
              </div>
              <div>
                <label className="label">Rôle</label>
                <select name="role" defaultValue="CONSULTANT" className="input">
                  <option value="CONSULTANT">Consultant</option>
                  <option value="MANAGER">Manager</option>
                  <option value="COMMERCIAL">Commercial</option>
                  <option value="FINANCE">Finance</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date d'entrée</label>
                  <input name="joinedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
                </div>
                <div>
                  <label className="label">Capacité hebdo (h)</label>
                  <input name="weeklyCapacityH" type="number" step="0.5" defaultValue="38" className="input" />
                </div>
              </div>
              <div>
                <label className="label">Mot de passe initial *</label>
                <div className="flex gap-2">
                  <input name="tempPassword" defaultValue={pwd} key={pwd} required minLength={8} className="input font-mono" />
                  <button type="button" onClick={() => setPwd(suggestPassword())} className="btn-ghost btn-sm">Régénérer</button>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
                <button disabled={pending} className="btn-primary">{pending ? "..." : "Recruter"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
