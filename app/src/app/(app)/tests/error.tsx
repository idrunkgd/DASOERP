"use client";
/**
 * Error boundary spécifique à la section Tests. Attrape les erreurs côté
 * render (client ou serveur) et affiche un message lisible — sinon Next.js
 * en prod masque le détail ("Server Components render error omitted…").
 */
import { useEffect } from "react";

export default function TestsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[tests/error.tsx]", error);
  }, [error]);
  return (
    <div className="card p-6 max-w-2xl mx-auto my-8">
      <h1 className="text-lg font-semibold text-rose-700 mb-2">
        Erreur sur la section Tests
      </h1>
      <p className="text-sm text-midnight-700 mb-3">
        {error.message || "Erreur inconnue"}
      </p>
      {error.digest && (
        <p className="text-[11px] font-mono text-midnight-500 mb-3">
          digest: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={() => reset()} className="btn-primary btn-sm">
          Réessayer
        </button>
        <a href="/tests" className="btn-ghost btn-sm">
          Retour à la liste
        </a>
      </div>
      <p className="text-[11px] text-midnight-500 mt-4">
        Si l'erreur persiste, envoie le texte ci-dessus (+ le digest) pour que
        l'équipe technique investigue.
      </p>
    </div>
  );
}
