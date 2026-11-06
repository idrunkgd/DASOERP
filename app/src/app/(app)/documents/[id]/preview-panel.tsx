"use client";
/**
 * Panneau de preview d'un document — embarque le fichier directement dans la
 * page détail pour éviter l'ouverture d'un onglet.
 *
 * Types supportés nativement par le navigateur :
 *   - PDF         → <iframe> (viewer PDF natif)
 *   - Image       → <img>
 *   - Texte       → <iframe> (plain text)
 * Autres (Word, Excel, zip, …) → fallback "ouvrir dans un nouvel onglet".
 */
import { useState } from "react";
import { Download, ExternalLink, Maximize2, Minimize2, Eye, EyeOff } from "lucide-react";

export function DocumentPreviewPanel({
  documentId, originalName, mimeType, size, title
}: {
  documentId: string;
  originalName: string;
  mimeType: string;
  size: number;
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const url = `/api/documents/${documentId}/download`;

  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const isText = mimeType.startsWith("text/");
  const isPreviewable = isPdf || isImage || isText;

  // Hauteurs responsives : mode normal ~ 80vh en sticky, mode étendu plein écran.
  const containerCls = expanded
    ? "fixed inset-4 z-50 bg-white rounded-xl shadow-2xl flex flex-col"
    : "card flex flex-col lg:sticky lg:top-4";
  const frameCls = expanded
    ? "flex-1 min-h-0"
    : "flex-1 min-h-[600px] lg:h-[calc(100vh-14rem)]";

  if (hidden) {
    return (
      <div className="card p-3 lg:sticky lg:top-4">
        <button
          onClick={() => setHidden(false)}
          className="w-full flex items-center justify-center gap-2 text-sm text-midnight-600 hover:text-midnight-900 py-2"
        >
          <Eye className="w-4 h-4" /> Afficher la preview
        </button>
      </div>
    );
  }

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onClick={() => setExpanded(false)}
        />
      )}
      <div className={containerCls}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-midnight-50/60 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-midnight-900 truncate">
              Aperçu — {title}
            </div>
            <div className="text-[10px] text-midnight-500 truncate">
              {originalName} · {mimeType} · {humanSize(size)}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded hover:bg-white text-midnight-500 hover:text-midnight-900"
              title="Ouvrir dans un nouvel onglet"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={url}
              download={originalName}
              className="p-1.5 rounded hover:bg-white text-midnight-500 hover:text-midnight-900"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded hover:bg-white text-midnight-500 hover:text-midnight-900"
              title={expanded ? "Réduire" : "Plein écran"}
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setHidden(true)}
              className="p-1.5 rounded hover:bg-white text-midnight-500 hover:text-midnight-900"
              title="Masquer la preview"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className={frameCls}>
          {isPdf && (
            <iframe
              src={url + "#view=FitH"}
              className="w-full h-full border-0 bg-midnight-100"
              title={title}
            />
          )}
          {isImage && (
            <div className="w-full h-full overflow-auto bg-midnight-100 grid place-items-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={title} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          {isText && (
            <iframe
              src={url}
              className="w-full h-full border-0 bg-white"
              title={title}
            />
          )}
          {!isPreviewable && (
            <div className="w-full h-full grid place-items-center p-6 text-center bg-midnight-50/40">
              <div className="space-y-3">
                <div className="text-sm text-midnight-700 font-medium">
                  Aperçu non disponible
                </div>
                <div className="text-xs text-midnight-500">
                  Le navigateur ne peut pas afficher directement {mimeType}.
                </div>
                <div className="flex flex-wrap gap-2 justify-center pt-2">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                    <ExternalLink className="w-3 h-3" /> Ouvrir
                  </a>
                  <a href={url} download={originalName} className="btn-primary btn-sm">
                    <Download className="w-3 h-3" /> Télécharger
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
