"use client";
import { useState, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Upload, X, FileIcon, Plus } from "lucide-react";
import { uploadDocument } from "@/server/actions/documents";

/**
 * Upload compact d'un document rattaché au véhicule.
 * Le vehicleId est passé en hidden input pour que la server action
 * documents.uploadDocument crée le Document avec la FK positionnée
 * et revalide /fleet/[id]. Après succès, refresh + toast.
 */
export function VehicleDocUpload({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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
    fd.set("vehicleId", vehicleId);
    if (tag) fd.set("tags", tag);
    start(async () => {
      try {
        await uploadDocument(fd);
        toast.success("Document ajouté");
        reset();
        setOpen(false);
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
        className="btn-secondary btn-sm w-full text-xs"
      >
        <Plus className="w-3 h-3" /> Ajouter un document
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 border border-border rounded-lg p-3 bg-muted/20">
      {/* Drop / pick */}
      <div
        onClick={() => inputRef.current?.click()}
        className={
          "border-2 border-dashed rounded-md p-2 text-center cursor-pointer transition-colors text-xs " +
          (file
            ? "border-emerald-300 bg-emerald-50/40"
            : "border-midnight-200 hover:border-midnight-300 hover:bg-midnight-50/40")
        }
      >
        {file ? (
          <div className="flex items-center gap-2 justify-center">
            <FileIcon className="w-4 h-4 text-emerald-600" />
            <span className="truncate max-w-[140px]">{file.name}</span>
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
            <Upload className="w-4 h-4 mx-auto mb-1 text-midnight-400" />
            Cliquer pour choisir un fichier
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Titre (contrat leasing, carte grise…)"
        className="input text-xs"
      />
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Tags (optionnel : Contrat, Assurance…)"
        className="input text-xs"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { reset(); setOpen(false); }}
          className="btn-ghost btn-sm text-xs"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={pending || !file}
          className="btn-primary btn-sm text-xs"
        >
          {pending ? "…" : "Uploader"}
        </button>
      </div>
    </form>
  );
}
