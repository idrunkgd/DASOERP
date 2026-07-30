"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { backfillPromotedCandidateExperiencesAction } from "@/server/actions/recruitment";

/**
 * Bouton "Rattraper le CV" — affiché sur la fiche candidat déjà recruté
 * quand un delta existe entre les CandidateExperience et les UserExperience.
 * Idempotent : si les expériences sont déjà là, retourne 0.
 */
export function BackfillCvButton({ candidateId, hint }: { candidateId: string; hint?: string }) {
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      try {
        const r = await backfillPromotedCandidateExperiencesAction(candidateId);
        if (r.created === 0) {
          toast.info("Le CV du consultant est déjà complet — rien à ajouter.");
        } else {
          toast.success(`${r.created} expérience${r.created > 1 ? "s" : ""} recopiée${r.created > 1 ? "s" : ""} vers le CV du consultant.`);
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={pending}
      className="btn-secondary btn-sm text-xs"
      title={hint ?? "Recopier les expériences vers la fiche consultant"}
    >
      <FileText className="w-3.5 h-3.5" />
      {pending ? "…" : "Rattraper le CV"}
    </button>
  );
}
