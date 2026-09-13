"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toggleCourseVisibility } from "@/server/actions/training";

/**
 * Petite icône œil pour les admins — bascule la visibilité d'un cours.
 * Ouvert = actif (visible catalogue consultant). Barré = masqué.
 */
export function ToggleCourseVisibility({ courseId, active }: { courseId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={active ? "Masquer ce cours" : "Rendre ce cours visible"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(async () => {
          try {
            const r = await toggleCourseVisibility(courseId);
            toast.success(r.active ? "Cours publié" : "Cours masqué");
          } catch (err: any) {
            toast.error(err?.message || "Erreur");
          }
        });
      }}
      disabled={pending}
      className={
        "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors " +
        (active
          ? "text-emerald-600 hover:bg-emerald-50"
          : "text-midnight-400 hover:bg-midnight-100")
      }
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> :
       active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
    </button>
  );
}
