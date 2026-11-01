"use client";
import { useRef, useState, useTransition } from "react";
import { createClientPortal } from "@/server/actions/client-portals";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export function NewPortalForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(file: File) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      toast.error("Fichier non reconnu comme image");
      return;
    }
    if (file.size > 800_000) {
      toast.error("Logo trop lourd (max 800 Ko)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  return (
    <form
      className="card p-6 space-y-4 max-w-2xl"
      action={(fd) => start(async () => {
        try {
          if (logoDataUrl) fd.set("logoUrl", logoDataUrl);
          await createClientPortal(fd);
        } catch (e: any) {
          toast.error(e.message || "Erreur");
        }
      })}
    >
      <div>
        <label className="label">Nom du portail *</label>
        <input name="name" required className="input" placeholder="GSK – Équipe Data, ou Veolia – Direction IT" />
        <p className="text-[11px] text-midnight-500 mt-1">
          Visible côté client, en haut de la page. Mets quelque chose de clair pour l'interlocuteur.
        </p>
      </div>

      <div>
        <label className="label">Société cliente *</label>
        <select name="companyId" required className="input">
          <option value="">Sélectionner…</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="text-[11px] text-midnight-500 mt-1">
          Si le client n'est pas dans la liste, crée-le d'abord dans Entreprises et marque-le comme client.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Contact (optionnel)</label>
          <input name="contactName" className="input" placeholder="Nom du contact" />
        </div>
        <div>
          <label className="label">Email contact</label>
          <input name="contactEmail" type="email" className="input" placeholder="contact@client.com" />
        </div>
      </div>

      <div>
        <label className="label">Logo client (optionnel)</label>
        <div className="flex items-center gap-3">
          {logoDataUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoDataUrl} alt="" className="w-16 h-16 rounded object-contain bg-white border" />
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-secondary flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> {logoDataUrl ? "Changer le logo" : "Uploader un logo"}
          </button>
          {logoDataUrl && (
            <button type="button" onClick={() => setLogoDataUrl(null)} className="btn-ghost text-rose-600">Retirer</button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }}
          />
        </div>
        <p className="text-[11px] text-midnight-500 mt-1">Max 800 Ko. Affiché en entête de la page client.</p>
      </div>

      <div>
        <label className="label">Notes internes</label>
        <textarea name="notes" rows={2} className="input" placeholder="Visible uniquement en interne." />
      </div>

      <input type="hidden" name="isActive" value="true" />

      <div className="flex justify-end gap-2">
        <button disabled={pending} className="btn-primary">
          {pending ? "Création…" : "Créer le portail"}
        </button>
      </div>
    </form>
  );
}
