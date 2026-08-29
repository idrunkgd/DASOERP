"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Écoute ← / → au clavier pour naviguer entre les slides.
 * Ignore les événements quand un input est focus (pour ne pas casser les quiz).
 */
export function KeyboardNav({ prevHref, nextHref }: { prevHref: string | null; nextHref: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorer si l'user tape dans un input / textarea / contenteditable
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "ArrowLeft" && prevHref) {
        e.preventDefault();
        router.push(prevHref);
      } else if (e.key === "ArrowRight" && nextHref) {
        e.preventDefault();
        router.push(nextHref);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prevHref, nextHref, router]);
  return null;
}
