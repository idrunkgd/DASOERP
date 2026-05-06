"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Avatar générique (candidat externe ou consultant interne) — affiche la photo
 * si dispo, sinon les initiales sur fond Midnight Indigo. Tolère les URLs invalides
 * en retombant sur les initiales en cas d'erreur de chargement.
 */
export function PersonAvatar({
  firstName, lastName, photoUrl, size = 56, className
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const initials = ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
  const showImage = !!photoUrl && !errored;
  const style = { width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.32)) };
  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl as string}
        alt={`${firstName} ${lastName}`}
        onError={() => setErrored(true)}
        className={cn("object-cover bg-midnight-50 rounded-full", className)}
        style={style}
      />
    );
  }
  return (
    <div
      className={cn("bg-midnight-900 text-white grid place-items-center font-semibold rounded-full select-none", className)}
      style={style}
      aria-label={`${firstName} ${lastName}`}
    >
      {initials}
    </div>
  );
}
