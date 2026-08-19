"use client";
import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { uploadNewPolicyVersion } from "@/server/actions/policies";
import { isNextControlFlow } from "@/lib/next-errors";

export function UploadNewVersion({ documentId }: { documentId: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function submit(fd: FormData) {
    if (!file) { toast.error("Choisis un PDF."); return; }
    fd.set("file", file);
    start(async () => {
      try {
        const r = await uploadNewPolicyVersion(documentId, fd);
        toast.success(`v${r.versionNum} uploadée`);
        setOpen(false);
        setFile(null);
        router.refresh();
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm w-full text-xs">
        <Upload className="w-3.5 h-3.5" /> Nouvelle version
      </button>
    );
  }

  return (
    <form action={submit} className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-indigoaccent">Nouvelle version</span>
        <button type="button" onClick={() => setOpen(false)} className="text-midnight-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        onClick={() => inputRef.current?.click()}
        className={
          "border border-dashed rounded p-2 text-center cursor-pointer text-xs " +
          (file ? "border-emerald-300 bg-emerald-50/40" : "border-midnight-200 hover:bg-midnight-50/40")
        }
      >
        {file ? file.name : "Choisir un PDF…"}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <input name="notes" placeholder="Notes (ce qui a changé)" className="input text-xs" />
      <button disabled={pending || !file} className="btn-primary btn-sm w-full text-xs">
        {pending ? "Upload…" : "Publier la version"}
      </button>
    </form>
  );
}
