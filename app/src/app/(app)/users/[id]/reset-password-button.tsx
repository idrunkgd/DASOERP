"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, X } from "lucide-react";
import { resetUserPassword } from "@/server/actions/users";

/**
 * Bouton dédié au reset du mot de passe. Volontairement isolé du UserForm
 * pour ne pas dépendre de la validation du gros form (qui peut échouer si
 * la DB a des colonnes en retard sur le schema Prisma).
 */
export function ResetPasswordButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Mot de passe trop court — 8 caractères minimum.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    start(async () => {
      try {
        await resetUserPassword(userId, password);
        toast.success("Mot de passe réinitialisé 🔒");
        setShowForm(false);
        setPassword("");
        setConfirm("");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="btn-secondary btn-sm"
        title="Définir un nouveau mot de passe"
      >
        <KeyRound className="w-3.5 h-3.5" /> Réinitialiser le mot de passe
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-3 max-w-md border-indigoaccent/40">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-sm flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-indigoaccent" />
          Nouveau mot de passe
        </h3>
        <button
          type="button"
          onClick={() => { setShowForm(false); setPassword(""); setConfirm(""); }}
          className="text-midnight-400 hover:text-midnight-800"
          aria-label="Annuler"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div>
        <label className="label">Nouveau mot de passe *</label>
        <input
          type="password" autoFocus required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          className="input"
        />
      </div>
      <div>
        <label className="label">Confirmer *</label>
        <input
          type="password" required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Retape le même"
          className="input"
        />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        Réinitialiser
      </button>
    </form>
  );
}
