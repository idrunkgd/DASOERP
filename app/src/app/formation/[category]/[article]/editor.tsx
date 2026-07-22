"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Edit3, Eye, Save, X, Loader2 } from "lucide-react";
import { updateWikiArticle } from "@/server/actions/wiki";
import { Markdown } from "./markdown";

/**
 * Toggle Aperçu / Édition markdown pour les admins.
 * En mode Aperçu : rendu prod.
 * En mode Édition : textarea plein écran + split view avec preview.
 */
export function ArticleEditor({
  id, initial, categorySlug, articleSlug
}: {
  id: string;
  initial: string;
  categorySlug: string;
  articleSlug: string;
}) {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [content, setContent] = useState(initial);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await updateWikiArticle(id, { content });
        toast.success("Article sauvegardé.");
        setMode("view");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (mode === "view") {
    return (
      <div className="relative">
        <button
          onClick={() => setMode("edit")}
          className="absolute -top-2 right-0 btn-ghost btn-sm text-xs"
          title="Modifier l'article"
        >
          <Edit3 className="w-3.5 h-3.5" /> Modifier
        </button>
        <article className="card p-8">
          <Markdown source={content} />
        </article>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 sticky top-14 bg-midnight-50/30 py-2 z-10">
        <div className="flex items-center gap-2 text-sm">
          <Edit3 className="w-4 h-4 text-indigoaccent" />
          <span className="font-medium">Mode édition</span>
          <span className="text-xs text-midnight-500">/formation/{categorySlug}/{articleSlug}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setContent(initial); setMode("view"); }}
            className="btn-ghost btn-sm text-xs"
            disabled={pending}
          >
            <X className="w-3.5 h-3.5" /> Annuler
          </button>
          <button
            onClick={save}
            className="btn-primary btn-sm text-xs"
            disabled={pending}
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sauvegarder
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="card p-0 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border text-xs text-midnight-500 flex items-center gap-1">
            <Edit3 className="w-3 h-3" /> Markdown
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-4 font-mono text-sm resize-none focus:outline-none min-h-[600px]"
            spellCheck={false}
          />
        </div>
        <div className="card p-0 overflow-hidden">
          <div className="px-3 py-1.5 border-b border-border text-xs text-midnight-500 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Aperçu
          </div>
          <div className="p-6 max-h-[600px] overflow-y-auto">
            <Markdown source={content} />
          </div>
        </div>
      </div>
      <div className="text-[11px] text-midnight-400 flex flex-wrap gap-x-3 gap-y-1">
        <span><code>#</code>/<code>##</code>/<code>###</code> titres</span>
        <span><code>**gras**</code> · <code>*italique*</code> · <code>`code`</code></span>
        <span><code>- item</code> ou <code>1. item</code></span>
        <span><code>&gt; [!TIP]</code>/<code>[!INFO]</code>/<code>[!WARN]</code>/<code>[!STEP]</code> callouts</span>
        <span><code>```lang</code> bloc de code</span>
      </div>
    </div>
  );
}
