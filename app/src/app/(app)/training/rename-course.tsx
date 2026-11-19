"use client";
/**
 * Bouton + modal pour renommer un cours (titre, sous-titre, niveau, durée).
 * Le slug reste inchangé (identifiant stable des URL / certificats / tags).
 */
import { useState, useTransition, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, X, Loader2 } from "lucide-react";
import { renameCourse } from "@/server/actions/training";

export function RenameCourseButton({
  courseId,
  initial
}: {
  courseId: string;
  initial: { title: string; subtitle: string | null; level: string | null; duration: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => { setMounted(true); }, []);

  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? "");
  const [level, setLevel] = useState(initial.level ?? "");
  const [duration, setDuration] = useState(initial.duration ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      try {
        await renameCourse(courseId, { title, subtitle: subtitle || null, level: level || null, duration: duration || null });
        toast.success("Cours renommé");
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur");
      }
    });
  }

  const modal = open && mounted ? createPortal((
    <div
      className="fixed inset-0 z-[9999] bg-black/50 grid place-items-center p-4 overflow-y-auto"
      onClick={() => setOpen(false)}
    >
      <form onSubmit={submit} className="card p-6 w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setOpen(false)} className="absolute top-3 right-3 text-midnight-400 hover:text-midnight-700">
          <X className="w-5 h-5" />
        </button>
        <h2 className="font-semibold text-lg mb-1">Renommer le cours</h2>
        <p className="text-xs text-midnight-500 mb-4">
          Le slug (URL, certificats déjà émis) n'est pas modifié.
        </p>
        <div className="space-y-3">
          <div>
            <label className="label">Titre *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" maxLength={200} required />
          </div>
          <div>
            <label className="label">Sous-titre</label>
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="input" maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Niveau</label>
              <input value={level} onChange={(e) => setLevel(e.target.value)} className="input" placeholder="Débutant à Expert" />
            </div>
            <div>
              <label className="label">Durée</label>
              <input value={duration} onChange={(e) => setDuration(e.target.value)} className="input" placeholder="3 à 4 jours" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Annuler</button>
          <button type="submit" disabled={pending || !title.trim()} className="btn-primary">
            {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  ), document.body) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-indigoaccent hover:underline inline-flex items-center gap-1"
        title="Renommer ce cours"
      >
        <Pencil className="w-3 h-3" /> Renommer
      </button>
      {modal}
    </>
  );
}
