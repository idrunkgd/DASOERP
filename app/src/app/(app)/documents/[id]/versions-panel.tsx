"use client";
// Panneau des versions : liste de la version actuelle + précédentes, formulaire
// d'upload d'une nouvelle version.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Download, Clock } from "lucide-react";
import { uploadDocumentVersion } from "@/server/actions/documents";

type VersionRow = {
  id: string;
  version: number;
  originalName: string;
  size: number;
  createdAt: string;
  uploadedBy: string | null;
};

export function VersionsPanel({
  documentId,
  currentVersion,
  versions
}: {
  documentId: string;
  currentVersion: VersionRow;
  versions: VersionRow[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function uploadNew(file: File) {
    const fd = new FormData();
    fd.set("file", file);
    setError(null);
    start(async () => {
      try {
        await uploadDocumentVersion(documentId, fd);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Erreur upload");
      }
    });
  }

  // La "version actuelle" est la plus récente entre currentVersion et versions
  // (versions sont triées DESC par version). La page envoie currentVersion =
  // le row racine. Donc si versions[0].version > currentVersion.version, c'est
  // la dernière. Pour la display on calcule.
  const latest = versions.length > 0 && versions[0].version > currentVersion.version
    ? versions[0]
    : currentVersion;
  const others = versions.length > 0 && versions[0].version > currentVersion.version
    ? [...versions.slice(1), currentVersion]
    : versions;

  return (
    <div className="card">
      <div className="card-header font-semibold text-sm flex items-center justify-between">
        <span>Versions</span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="text-xs text-indigoaccent hover:underline flex items-center gap-1"
        >
          <Upload className="w-3 h-3" />
          {pending ? "..." : "Nouvelle version"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadNew(f);
        }}
      />
      <div className="p-3">
        {error && (
          <div className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1 mb-2">
            {error}
          </div>
        )}
        <ul className="space-y-2">
          <li className="bg-emerald-50 border border-emerald-200 rounded p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-emerald-900">
                  V{latest.version} · actuelle
                </div>
                <div className="text-[10px] text-midnight-600 truncate">
                  {latest.originalName}
                </div>
                <div className="text-[10px] text-midnight-400">
                  {latest.createdAt} · {humanSize(latest.size)}
                  {latest.uploadedBy && ` · ${latest.uploadedBy}`}
                </div>
              </div>
              <a
                href={`/api/documents/${latest.id}/download`}
                className="text-emerald-700 hover:text-emerald-900 p-1"
                aria-label="Télécharger"
              >
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          </li>
          {others.map((v) => (
            <li
              key={v.id}
              className="rounded p-2 hover:bg-midnight-50/50 border border-midnight-100"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-midnight-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> V{v.version}
                  </div>
                  <div className="text-[10px] text-midnight-500 truncate">
                    {v.originalName}
                  </div>
                  <div className="text-[10px] text-midnight-400">
                    {v.createdAt} · {humanSize(v.size)}
                    {v.uploadedBy && ` · ${v.uploadedBy}`}
                  </div>
                </div>
                <a
                  href={`/api/documents/${v.id}/download`}
                  className="text-midnight-500 hover:text-midnight-900 p-1"
                  aria-label="Télécharger"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
