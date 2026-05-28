"use client";
// Form de création/édition d'une page wiki, avec preview markdown en live
// (toggle ou split-view selon la largeur d'écran).
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { createWikiPage, updateWikiPage, deleteWikiPage } from "@/server/actions/wiki";
import { MarkdownView } from "./markdown-view";

type Page = {
  id: string;
  title: string;
  slug: string;
  body: string;
  category: string | null;
  pinned: boolean;
};

export function WikiPageForm({
  mode,
  page
}: {
  mode: "create" | "edit";
  page?: Page;
}) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [body, setBody] = useState(page?.body ?? "");
  const [category, setCategory] = useState(page?.category ?? "");
  const [pinned, setPinned] = useState(page?.pinned ?? false);
  const [showPreview, setShowPreview] = useState(true);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("title", title);
    fd.set("slug", slug);
    fd.set("body", body);
    fd.set("category", category);
    fd.set("pinned", pinned ? "true" : "false");
    setError(null);
    start(async () => {
      try {
        if (mode === "create") {
          await createWikiPage(fd);
        } else if (page) {
          await updateWikiPage(page.id, fd);
        }
      } catch (e: any) {
        setError(e?.message || "Erreur");
      }
    });
  }

  function onDelete() {
    if (!page) return;
    if (!confirm(`Supprimer définitivement « ${page.title} » ?`)) return;
    start(async () => {
      try {
        await deleteWikiPage(page.id);
      } catch (e: any) {
        setError(e?.message || "Erreur");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-midnight-700">
            Titre <span className="text-red-600">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={120}
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">
            Catégorie
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Process RH, Procédures IT..."
            maxLength={60}
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">
            Slug (URL)
          </label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="auto depuis le titre"
            maxLength={120}
            className="input mt-1 font-mono text-xs"
          />
        </div>
        <div className="md:col-span-4 flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            Épingler en haut
          </label>
          <label className="flex items-center gap-2 text-xs ml-auto">
            <input
              type="checkbox"
              checked={showPreview}
              onChange={(e) => setShowPreview(e.target.checked)}
            />
            Afficher la preview
          </label>
        </div>
      </div>

      <div className={`grid gap-4 ${showPreview ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        <div className="card p-3">
          <div className="text-[10px] uppercase tracking-wider text-midnight-400 font-semibold mb-2">
            Markdown
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={24}
            placeholder={`# Titre

Ton contenu en **markdown** ici.

- bullet
- liste
- ordonnée

[Un lien](https://exemple.com)
\`du code\`
`}
            className="input font-mono text-xs leading-relaxed resize-y w-full"
          />
        </div>
        {showPreview && (
          <div className="card p-4 overflow-auto">
            <div className="text-[10px] uppercase tracking-wider text-midnight-400 font-semibold mb-2">
              Preview
            </div>
            <MarkdownView source={body || "*(vide)*"} />
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        {mode === "edit" && page ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-xs text-red-700 hover:text-red-900 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Supprimer la page
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary"
          >
            {pending
              ? "..."
              : mode === "create"
              ? "Créer la page"
              : "Enregistrer"}
          </button>
        </div>
      </div>
    </form>
  );
}
