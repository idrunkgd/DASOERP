"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createOpportunity } from "@/server/actions/opportunities";

export function NewOpportunityForm({
  companies,
  owners,
  defaultOwnerId
}: {
  companies: { id: string; name: string }[];
  owners: { id: string; label: string }[];
  defaultOwnerId: string;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function submit(formData: FormData) {
    start(async () => {
      try {
        await createOpportunity(formData);
        toast.success("Opportunité créée");
        setOpen(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary text-sm">
        <Plus className="w-4 h-4" />
        Ajouter une opportunité
      </button>
    );
  }

  return (
    <form action={submit} className="grid md:grid-cols-2 gap-3">
      <div className="md:col-span-2">
        <label className="label">Titre</label>
        <input name="title" className="input" required placeholder="ex: Refonte intranet ACME" />
      </div>
      <div>
        <label className="label">Société (existante)</label>
        <select name="companyId" className="input">
          <option value="">— Nouvelle / inconnue —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Source</label>
        <input name="source" className="input" placeholder="LinkedIn, reco, salon…" />
      </div>
      <div>
        <label className="label">Nom prospect (si pas en base)</label>
        <input name="prospectName" className="input" placeholder="Jean Dupont — ACME" />
      </div>
      <div>
        <label className="label">Email prospect</label>
        <input name="prospectEmail" type="email" className="input" />
      </div>
      <div>
        <label className="label">Valeur estimée HTVA</label>
        <input
          name="estimatedValue"
          type="number"
          step="0.01"
          defaultValue="0"
          className="input"
        />
      </div>
      <div>
        <label className="label">Probabilité (%)</label>
        <input
          name="probability"
          type="number"
          min="0"
          max="100"
          defaultValue="20"
          className="input"
        />
      </div>
      <div>
        <label className="label">Date prévisionnelle</label>
        <input name="expectedCloseAt" type="date" className="input" />
      </div>
      <div>
        <label className="label">Owner</label>
        <select name="ownerId" defaultValue={defaultOwnerId} className="input">
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="label">Description / besoin</label>
        <textarea name="description" rows={3} className="input" />
      </div>
      <div className="md:col-span-2 flex gap-2 justify-end">
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button type="submit" className="btn-primary text-sm" disabled={pending}>
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Créer
        </button>
      </div>
    </form>
  );
}
