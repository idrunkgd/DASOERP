"use client";
/**
 * Global error boundary Next.js — attrape TOUTES les erreurs client/server
 * qui remontent jusqu'à la racine. Poste l'erreur vers /api/log-error pour
 * qu'elle soit persistée dans AppLog (visible sur /logs).
 *
 * Doit être placé à la racine de l'app (app/global-error.tsx).
 */
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Poste l'erreur vers l'API (fire-and-forget)
    fetch("/api/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "ERROR",
        message: error?.message ?? "Unknown client error",
        stack: error?.stack ?? null,
        path: typeof window !== "undefined" ? window.location.pathname : null,
        meta: { digest: error?.digest ?? null }
      })
    }).catch(() => { /* silencieux */ });
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, maxWidth: 800, margin: "0 auto" }}>
        <h1 style={{ color: "#dc2626", fontSize: 24, marginBottom: 12 }}>Oups, une erreur est survenue.</h1>
        <p style={{ color: "#6b7280", marginBottom: 20 }}>
          L&apos;erreur a été enregistrée. Un admin peut la consulter sur <code>/logs</code>.
        </p>
        {error?.digest && (
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>
            Référence : <code>{error.digest}</code>
          </p>
        )}
        <button
          onClick={() => reset()}
          style={{
            background: "#0F1B3D", color: "white", padding: "10px 18px",
            border: 0, borderRadius: 6, cursor: "pointer", fontWeight: 600
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
