"use client";
// Modal d'ajout / édition d'un AppLink. Réservé aux admins (le bouton
// déclencheur n'est rendu côté serveur que pour eux). En mode "create" on
// rend un bouton "Ajouter une app" ; en mode "edit" on rend une petite
// icône crayon discrète dans le coin de la dalle.
import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { createAppLink, updateAppLink, deleteAppLink } from "@/server/actions/app-links";

type Link = {
  id: string;
  name: string;
  url: string;
  description: string | null;
};

export function AppLinksManager({
  mode,
  link
}: {
  mode: "create" | "edit";
  link?: Link;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {mode === "create" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Ajouter une app
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className="bg-white shadow-sm border border-midnight-200 rounded-md p-1 text-midnight-500 hover:text-midnight-900 hover:bg-midnight-50"
          aria-label="Modifier"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 bg-midnight-900/40 grid place-items-center p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-midnight-900">
                  {mode === "create" ? "Ajouter une app" : "Modifier l'app"}
                </h3>
                <p className="text-xs text-midnight-500 mt-0.5">
                  Lien vers une application externe utilisée par Dasolabs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="text-midnight-400 hover:text-midnight-900 p-1"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              action={(formData) => {
                setError(null);
                startTransition(async () => {
                  try {
                    if (mode === "create") {
                      await createAppLink(formData);
                    } else if (link) {
                      await updateAppLink(link.id, formData);
                    }
                    setOpen(false);
                  } catch (e: any) {
                    setError(e?.message || "Erreur");
                  }
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-medium text-midnight-700">
                  Nom <span className="text-red-600">*</span>
                </label>
                <input
                  name="name"
                  defaultValue={link?.name}
                  required
                  maxLength={60}
                  placeholder="Hetzner Cloud"
                  className="input mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-midnight-700">
                  URL <span className="text-red-600">*</span>
                </label>
                <input
                  name="url"
                  type="url"
                  defaultValue={link?.url}
                  required
                  maxLength={500}
                  placeholder="https://console.hetzner.cloud"
                  className="input mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-midnight-700">
                  Description
                </label>
                <textarea
                  name="description"
                  defaultValue={link?.description ?? ""}
                  maxLength={280}
                  rows={3}
                  placeholder="VPS de production qui héberge Dasohub."
                  className="input mt-1 resize-y"
                />
                <p className="text-[10px] text-midnight-400 mt-1">
                  Maximum 280 caractères.
                </p>
              </div>

              {error && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                {mode === "edit" && link ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Supprimer le lien « ${link.name} » ?`
                        )
                      )
                        return;
                      setError(null);
                      startTransition(async () => {
                        try {
                          await deleteAppLink(link.id);
                          setOpen(false);
                        } catch (e: any) {
                          setError(e?.message || "Erreur");
                        }
                      });
                    }}
                    className="text-xs text-red-700 hover:text-red-900 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    className="btn-secondary"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={pending}
                    className="btn-primary"
                  >
                    {pending
                      ? "..."
                      : mode === "create"
                      ? "Ajouter"
                      : "Enregistrer"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
