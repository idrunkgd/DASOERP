"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { PenLine } from "lucide-react";
import { signPolicy } from "@/server/actions/policies";
import { isNextControlFlow } from "@/lib/next-errors";

/**
 * Formulaire de signature électronique simple : l'user tape son nom
 * complet en attestation "Lu et approuvé". Timestamp + IP + user-agent
 * sont capturés côté serveur.
 */
export function SignForm({
  signatureId,
  suggestedName
}: {
  signatureId: string;
  suggestedName?: string;
}) {
  const [pending, start] = useTransition();
  function submit(fd: FormData) {
    start(async () => {
      try {
        await signPolicy(signatureId, fd);
        toast.success("Signature enregistrée");
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <form action={submit} className="space-y-3">
      <div className="text-sm text-midnight-800">
        <PenLine className="w-4 h-4 inline mr-1 text-indigoaccent" />
        <strong>Signature électronique</strong>
      </div>
      <p className="text-xs text-midnight-600">
        En tapant ton nom complet ci-dessous, tu attestes avoir lu et compris
        ce document, et t'engages à le respecter. Cette action est horodatée
        et tracée (IP + navigateur) comme signature électronique simple valide
        pour ce type de document interne.
      </p>
      <div>
        <label className="label">Tape ton nom complet</label>
        <input
          name="signatureText"
          required
          minLength={3}
          defaultValue={suggestedName ?? ""}
          className="input"
          placeholder="Prénom Nom"
        />
      </div>
      <div className="flex justify-end">
        <button disabled={pending} className="btn-primary btn-sm">
          <PenLine className="w-4 h-4" /> {pending ? "Signature…" : "Signer « Lu et approuvé »"}
        </button>
      </div>
    </form>
  );
}
