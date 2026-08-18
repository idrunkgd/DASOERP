"use client";
import { useFormStatus } from "react-dom";

/**
 * Bouton submit qui se désactive automatiquement pendant la soumission
 * du <form> parent. Évite les double-clics sur les formulaires server
 * qui produiraient des doublons (véhicule créé 2×, plaque en collision,
 * etc.) avant que le redirect Next.js prenne effet.
 *
 * Usage:
 *   <form action={serverAction}>
 *     ...
 *     <SubmitButton>Créer</SubmitButton>
 *   </form>
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-primary"
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingLabel ?? "…") : children}
    </button>
  );
}
