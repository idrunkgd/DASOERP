"use client";
import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { createCandidatePortalAction } from "@/server/actions/recruitment";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

function suggestPassword() {
  return `Cv!${Math.random().toString(36).slice(-8)}`;
}

export function CandidatePortalButton({ candidateId, suggestedEmail }: { candidateId: string; suggestedEmail: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [pwd, setPwd] = useState(suggestPassword());

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/40" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 m-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold mb-1">Compte portail candidat</h2>
            <p className="text-xs text-midnight-500 mb-4">
              Crée un compte de connexion pour ce candidat. Il pourra se connecter avec ces identifiants
              et compléter son CV (photo, compétences, langues, expérience…) en self-service.
              Aucun accès aux modules de l'application — seulement son propre profil.
            </p>
            <form
              action={(fd) => start(async () => {
                try { await createCandidatePortalAction(candidateId, fd); toast.success("Compte créé — communiquez les identifiants au candidat"); setOpen(false); }
                catch (e: any) { toast.error(e.message); }
              })}
              className="space-y-3"
            >
              <div>
                <label className="label">Email Dasolabs *</label>
                <input name="email" type="email" defaultValue={suggestedEmail} required className="input font-mono" placeholder="ext.prenom@dasolabs.be" />
                <p className="text-[11px] text-midnight-500 mt-1">Convention : <code>ext.prenom@dasolabs.be</code>. Sert uniquement d'identifiant de connexion — le candidat reste externe.</p>
              </div>
              <div>
                <label className="label">Mot de passe initial *</label>
                <div className="flex gap-2">
                  <input name="tempPassword" defaultValue={pwd} key={pwd} required minLength={8} className="input font-mono" />
                  <button type="button" onClick={() => setPwd(suggestPassword())} className="btn-ghost btn-sm">↻</button>
                </div>
                <p className="text-[11px] text-midnight-500 mt-1">Communiquez-le hors-bande, il pourra le changer à la première connexion.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
                <button disabled={pending} className="btn-primary">{pending ? "..." : "Créer le compte"}</button>
              </div>
            </form>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm flex items-center gap-1">
        <KeyRound className="w-3 h-3" /> Créer compte portail
      </button>
      {modal}
    </>
  );
}
