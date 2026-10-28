"use client";
import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Upload, X, FileIcon, Plus, Trash2, Download } from "lucide-react";
import { uploadDocument, deleteDocument } from "@/server/actions/documents";
import { useRouter } from "next/navigation";

type DocRow = {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  size: number;
  tags: string[];
  createdAt: string;
  uploadedBy: { firstName: string; lastName: string } | null;
};

export function CandidateDocumentsPanel({
  candidateId, documents, canManage
}: {
  candidateId: string;
  documents: DocRow[];
  canManage: boolean;
}) {
  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Fichiers du candidat ({documents.length})</h2>
      </div>
      <p className="text-xs text-midnight-500">
        Documents rattachés à cette fiche candidat : CV externes, rapports d'entretien,
        lettres de motivation, résultats de tests, pièces diverses. Formats acceptés :
        PDF, Word, images (max 50 MB par fichier).
      </p>

      {canManage && <CandidateDocUpload candidateId={candidateId} />}

      {documents.length === 0 ? (
        <p className="text-sm text-midnight-500 italic">Aucun fichier pour l'instant.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-midnight-50 text-xs uppercase tracking-wide text-midnight-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Titre</th>
                <th className="px-3 py-2 text-left font-medium">Tags</th>
                <th className="px-3 py-2 text-right font-medium">Taille</th>
                <th className="px-3 py-2 text-left font-medium">Ajouté par</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <DocRowItem key={d.id} doc={d} canManage={canManage} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DocRowItem({ doc, canManage }: { doc: DocRow; canManage: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!window.confirm(`Supprimer le fichier « ${doc.title} » ?`)) return;
    start(async () => {
      try {
        await deleteDocument(doc.id);
        toast.success("Fichier supprimé");
        router.refresh();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur suppression");
      }
    });
  }

  return (
    <tr className="border-t border-border/60 hover:bg-midnight-50/40">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <FileIcon className="w-4 h-4 text-midnight-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-midnight-900 truncate">{doc.title}</div>
            <div className="text-[11px] text-midnight-500 truncate">{doc.originalName}</div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          {doc.tags.map((t) => <span key={t} className="badge-info text-[10px] px-1.5 py-0">{t}</span>)}
        </div>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-midnight-700">{humanSize(doc.size)}</td>
      <td className="px-3 py-2 text-midnight-700">
        {doc.uploadedBy ? `${doc.uploadedBy.firstName} ${doc.uploadedBy.lastName}` : "—"}
      </td>
      <td className="px-3 py-2 text-midnight-500 text-xs">
        {new Date(doc.createdAt).toLocaleDateString("fr-BE")}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <a
          href={`/api/documents/${doc.id}/download`}
          className="btn-ghost btn-sm"
          target="_blank" rel="noopener noreferrer"
          title="Télécharger"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
        {canManage && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="btn-ghost btn-sm text-red-600"
            title="Supprimer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function CandidateDocUpload({ candidateId }: { candidateId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function pickFile(f: File | null) {
    setFile(f);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  function reset() {
    setFile(null);
    setTitle("");
    setTag("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("title", title || file.name);
    fd.set("candidateId", candidateId);
    if (tag) fd.set("tags", tag);
    start(async () => {
      try {
        await uploadDocument(fd);
        toast.success("Fichier ajouté");
        reset();
        setOpen(false);
        router.refresh();
      } catch (err: any) {
        toast.error(err?.message ?? "Erreur upload");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-sm"
      >
        <Plus className="w-4 h-4" /> Ajouter un fichier
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 border border-border rounded-lg p-3 bg-midnight-50/40">
      <div
        onClick={() => inputRef.current?.click()}
        className={
          "border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors text-sm " +
          (file
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-midnight-200 hover:border-midnight-300 hover:bg-midnight-50/40")
        }
      >
        {file ? (
          <div className="flex items-center gap-2 justify-center">
            <FileIcon className="w-4 h-4 text-emerald-600" />
            <span className="truncate max-w-[260px]">{file.name}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); pickFile(null); }}
              className="text-midnight-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="text-midnight-500">
            <Upload className="w-5 h-5 mx-auto mb-1 text-midnight-400" />
            Cliquer pour choisir un fichier (PDF, Word, image…)
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Titre (CV, rapport d'entretien...)"
        className="input text-sm"
      />
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Tags (optionnel : CV, Entretien, Motivation…)"
        className="input text-sm"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          className="btn-ghost btn-sm"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending || !file}
          className="btn-primary btn-sm"
        >
          {pending ? "…" : "Uploader"}
        </button>
      </div>
    </form>
  );
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
