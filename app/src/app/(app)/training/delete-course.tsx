"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteCourse } from "@/server/actions/training";

/**
 * Bouton poubelle pour supprimer un cours du catalogue.
 * Ouvre une modale de confirmation avec double check (nom du cours à re-saisir)
 * pour éviter les fausses manip. Les certificats émis sont préservés.
 */
export function DeleteCourse({
  courseId,
  courseTitle,
  courseSlug,
  slideCount
}: {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  slideCount: number;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim().toLowerCase() === courseSlug.toLowerCase();

  return (
    <>
      <button
        type="button"
        title="Supprimer ce cours"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight-900/60 backdrop-blur-sm p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-border overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-border bg-rose-50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-bold text-midnight-900">Supprimer ce cours ?</h3>
                  <p className="text-sm text-midnight-600 mt-0.5">Action non réversible.</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm text-midnight-800">
                  Tu es sur le point de supprimer <strong>« {courseTitle} »</strong>.
                </p>
                <ul className="mt-3 text-sm text-midnight-700 space-y-1 list-disc pl-5">
                  <li>{slideCount} slides seront effacées</li>
                  <li>Toutes les progressions en cours seront perdues</li>
                  <li>Toutes les tentatives de quiz seront effacées</li>
                  <li className="text-emerald-700 font-semibold">Les certificats déjà émis restent préservés</li>
                </ul>
              </div>

              <div className="rounded-lg bg-amber-50 border-l-4 border-amber-400 p-3">
                <p className="text-xs text-amber-900 font-medium">
                  Pour confirmer, tape le slug du cours :
                </p>
                <p className="text-xs text-amber-800 font-mono mt-1">{courseSlug}</p>
              </div>

              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={courseSlug}
                className="input w-full"
                autoFocus
              />
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-border bg-midnight-50/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="btn-ghost text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!canConfirm || pending}
                onClick={() =>
                  start(async () => {
                    try {
                      const r = await deleteCourse(courseId);
                      toast.success(`Cours « ${r.deletedCourse} » supprimé (${r.slidesDeleted} slides).`);
                      setOpen(false);
                    } catch (err: any) {
                      toast.error(err?.message || "Erreur");
                    }
                  })
                }
                className="btn-danger text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
