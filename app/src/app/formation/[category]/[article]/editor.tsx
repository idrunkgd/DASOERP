"use client";
import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Edit3, Eye, Save, X, Loader2, ImagePlus, CheckCircle2 } from "lucide-react";
import { updateWikiArticle, uploadWikiImage, markArticleReviewed } from "@/server/actions/wiki";
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
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  function markReviewed() {
    start(async () => {
      try {
        await markArticleReviewed(id);
        toast.success("Article marqué vérifié aujourd'hui.");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  /**
   * Upload une image et insère la syntaxe markdown au curseur.
   * Si le curseur n'est pas positionné, insère à la fin.
   */
  async function handleImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await uploadWikiImage(fd);
      const alt = file.name.replace(/\.[^.]+$/, "");
      const snippet = `\n\n![${alt}](${r.url})\n\n`;
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart ?? content.length;
        const end   = ta.selectionEnd ?? content.length;
        const next = content.slice(0, start) + snippet + content.slice(end);
        setContent(next);
        // Repositionne le curseur après l'image
        setTimeout(() => {
          ta.focus();
          const pos = start + snippet.length;
          ta.setSelectionRange(pos, pos);
        }, 10);
      } else {
        setContent(content + snippet);
      }
      toast.success("Image insérée.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur d'upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (mode === "view") {
    return (
      <div className="relative">
        <div className="absolute -top-2 right-0 flex items-center gap-2">
          <button
            onClick={markReviewed}
            disabled={pending}
            className="btn-ghost btn-sm text-xs text-emerald-700"
            title="Confirmer que cet article reflète la version actuelle de l'ERP"
          >
            {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Marquer vérifié
          </button>
          <button
            onClick={() => setMode("edit")}
            className="btn-ghost btn-sm text-xs"
            title="Modifier l'article"
          >
            <Edit3 className="w-3.5 h-3.5" /> Modifier
          </button>
        </div>
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImage(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost btn-sm text-xs"
            disabled={pending || uploading}
            title="Insérer une capture d'écran au curseur"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
            Image
          </button>
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
            ref={textareaRef}
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
        <span><code>![alt](url)</code> image (utilise le bouton Image ci-dessus)</span>
      </div>
    </div>
  );
}
