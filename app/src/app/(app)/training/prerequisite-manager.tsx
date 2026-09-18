"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { setCoursePrerequisite } from "@/server/actions/training";

type CourseOption = { id: string; title: string };

/**
 * Bouton "chaîne" pour gérer le cours prérequis d'un cours.
 * Ouvre une modale avec select des autres cours.
 * Réservé aux admins (training.manage).
 */
export function PrerequisiteManager({
  courseId,
  courseTitle,
  currentPrerequisiteId,
  currentPrerequisiteTitle,
  allCourses
}: {
  courseId: string;
  courseTitle: string;
  currentPrerequisiteId: string | null;
  currentPrerequisiteTitle: string | null;
  allCourses: CourseOption[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<string>(currentPrerequisiteId ?? "");

  const otherCourses = allCourses.filter((c) => c.id !== courseId);
  const hasPrereq = !!currentPrerequisiteId;

  return (
    <>
      <button
        type="button"
        title={hasPrereq ? `Prérequis : ${currentPrerequisiteTitle}` : "Définir un cours prérequis"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelected(currentPrerequisiteId ?? "");
          setOpen(true);
        }}
        className={
          "inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors " +
          (hasPrereq ? "text-amber-600 hover:bg-amber-50" : "text-midnight-400 hover:bg-midnight-100")
        }
      >
        <Link2 className="w-4 h-4" />
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
            <div className="p-5 border-b border-border bg-amber-50">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Link2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-midnight-900">Cours prérequis</h3>
                  <p className="text-sm text-midnight-600 mt-0.5">
                    Pour <strong>« {courseTitle} »</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-midnight-700">
                Sélectionne le cours que le consultant doit avoir <strong>réussi</strong> (certificat émis)
                avant de pouvoir démarrer celui-ci.
              </p>

              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="input w-full"
                disabled={pending}
              >
                <option value="">— Aucun prérequis —</option>
                {otherCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>

              <p className="text-xs text-midnight-500 italic">
                Les admins bypassent toujours les prérequis.
              </p>
            </div>

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
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    try {
                      await setCoursePrerequisite(courseId, selected || null);
                      toast.success(selected ? "Prérequis défini" : "Prérequis retiré");
                      setOpen(false);
                    } catch (err: any) {
                      toast.error(err?.message || "Erreur");
                    }
                  })
                }
                className="btn-primary text-sm inline-flex items-center gap-2"
              >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
