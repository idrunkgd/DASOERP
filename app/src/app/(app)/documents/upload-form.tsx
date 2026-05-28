"use client";
// Formulaire d'upload : drag-and-drop ou click, métadonnées (titre/tags/
// expiration), liens optionnels vers entités.
import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileIcon } from "lucide-react";
import { uploadDocument } from "@/server/actions/documents";

type Option = { id: string; name?: string; firstName?: string; lastName?: string; reference?: string; title?: string };

export function UploadDocumentForm({
  companies,
  projects,
  offers,
  consultants,
  existingTags
}: {
  companies: { id: string; name: string }[];
  projects: { id: string; name: string; reference: string }[];
  offers: { id: string; title: string; reference: string }[];
  consultants: { id: string; firstName: string; lastName: string }[];
  existingTags: string[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function pickFile(f: File | null) {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) {
      setError("Choisis un fichier");
      return;
    }
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("file", file);
    fd.set("title", title || file.name);
    start(async () => {
      try {
        await uploadDocument(fd);
        // Reset
        setFile(null);
        setTitle("");
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } catch (e: any) {
        setError(e?.message || "Erreur upload");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.[0]) pickFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-indigoaccent bg-indigoaccent/5"
            : file
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-midnight-200 hover:border-midnight-300 hover:bg-midnight-50/40"
        }`}
      >
        {file ? (
          <div className="flex items-center justify-center gap-3 text-sm">
            <FileIcon className="w-5 h-5 text-emerald-600" />
            <div className="text-left">
              <div className="font-medium text-midnight-900">{file.name}</div>
              <div className="text-[11px] text-midnight-500">
                {(file.size / 1024).toFixed(0)} KB · {file.type || "?"}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pickFile(null);
              }}
              className="text-midnight-400 hover:text-red-600 p-1"
              aria-label="Retirer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-midnight-500">
            <Upload className="w-5 h-5 mx-auto mb-1 text-midnight-400" />
            Glisse un fichier ici ou clique pour parcourir
            <div className="text-[10px] mt-1 text-midnight-400">Max 50 MB</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {/* Métadonnées */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-midnight-700">
            Titre <span className="text-red-600">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={200}
            placeholder="Ex: Contrat-cadre Zoetis 2026"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">
            Tags (CSV)
          </label>
          <input
            name="tags"
            list="existing-tags"
            placeholder="Contrat, NDA, RH..."
            className="input mt-1"
          />
          <datalist id="existing-tags">
            {existingTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">
            Expiration
          </label>
          <input
            name="expiresAt"
            type="date"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">
            Description
          </label>
          <input
            name="description"
            maxLength={500}
            placeholder="Note rapide..."
            className="input mt-1"
          />
        </div>
      </div>

      {/* Liens entités */}
      <details>
        <summary className="cursor-pointer text-xs text-midnight-600 hover:text-midnight-900">
          Lier à une entité (entreprise / projet / offre / consultant)
        </summary>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pl-1">
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Entreprise
            </label>
            <select name="companyId" className="input mt-1">
              <option value="">—</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Projet
            </label>
            <select name="projectId" className="input mt-1">
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.reference} — {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Offre
            </label>
            <select name="offerId" className="input mt-1">
              <option value="">—</option>
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.reference} — {o.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-midnight-700">
              Consultant
            </label>
            <select name="consultantId" className="input mt-1">
              <option value="">—</option>
              {consultants.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !file}
          className="btn-primary"
        >
          <Upload className="w-4 h-4" />
          {pending ? "Upload en cours…" : "Uploader"}
        </button>
      </div>
    </form>
  );
}
