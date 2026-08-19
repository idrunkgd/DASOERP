"use client";
import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Upload, FileIcon, X, Plus } from "lucide-react";
import { createPolicy } from "@/server/actions/policies";
import { isNextControlFlow } from "@/lib/next-errors";

export function NewPolicyForm() {
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function submit(fd: FormData) {
    if (!file) { toast.error("Choisis un PDF."); return; }
    fd.set("file", file);
    start(async () => {
      try {
        const r = await createPolicy(fd);
        toast.success("Politique créée");
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
        router.push(`/policies/${r.id}`);
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <form action={submit} className="space-y-3">
      <div
        onClick={() => inputRef.current?.click()}
        className={
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors " +
          (file ? "border-emerald-300 bg-emerald-50/40" : "border-midnight-200 hover:border-midnight-300 hover:bg-midnight-50/40")
        }
      >
        {file ? (
          <div className="flex items-center justify-center gap-3 text-sm">
            <FileIcon className="w-5 h-5 text-emerald-600" />
            <div className="text-left">
              <div className="font-medium text-midnight-900">{file.name}</div>
              <div className="text-[11px] text-midnight-500">{(file.size / 1024).toFixed(0)} KB</div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
              className="text-midnight-400 hover:text-red-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="text-xs text-midnight-500">
            <Upload className="w-5 h-5 mx-auto mb-1 text-midnight-400" />
            Clic pour choisir un PDF (max 20 Mo)
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="label">Titre *</label>
          <input name="title" required maxLength={200} className="input" placeholder="Ex: Charte informatique — v1" />
        </div>
        <div>
          <label className="label">Catégorie</label>
          <input name="category" list="policy-categories" className="input" placeholder="RH, IT, Sécurité…" />
          <datalist id="policy-categories">
            <option value="RH" />
            <option value="IT" />
            <option value="Sécurité" />
            <option value="EPI" />
            <option value="Voiture" />
            <option value="Télétravail" />
          </datalist>
        </div>
      </div>
      <div>
        <label className="label">Description (optionnel)</label>
        <input name="description" maxLength={500} className="input" placeholder="Brève description affichée dans la liste" />
      </div>
      <div>
        <label className="label">Notes de version (optionnel)</label>
        <input name="notes" maxLength={500} className="input" placeholder="Ex: Version initiale" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mandatory" value="true" defaultChecked />
        <span>Obligatoire pour tous les employés</span>
      </label>
      <div className="flex justify-end pt-1">
        <button disabled={pending || !file} className="btn-primary btn-sm">
          <Plus className="w-4 h-4" /> {pending ? "Création…" : "Créer la politique"}
        </button>
      </div>
    </form>
  );
}
