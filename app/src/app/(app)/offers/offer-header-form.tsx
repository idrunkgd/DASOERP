"use client";
import { useTransition } from "react";
import { createOfferAction, updateOfferHeader } from "@/server/actions/offers";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Initial = {
  id?: string; title?: string; mode?: string; companyId?: string; ownerId?: string | null; status?: string;
  probability?: number; description?: string | null; comments?: string | null;
  sentAt?: Date | string | null; expectedDecisionAt?: Date | string | null;
};

function dateInput(d?: Date | string | null) {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

export function OfferHeaderForm({
  initial, companies, users, initialOwnerId, readOnly = false
}: {
  initial?: Initial;
  companies: { id: string; name: string }[];
  users: { id: string; firstName: string; lastName: string }[];
  initialOwnerId?: string;
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) {
            await updateOfferHeader(initial.id, fd);
            toast.success("Offre mise à jour"); router.refresh();
          } else {
            await createOfferAction(fd);
          }
        } catch (e: any) { toast.error(e.message); }
      })}
      className="card p-6 space-y-4"
    >
      <fieldset disabled={readOnly} className={readOnly ? "opacity-70" : ""}>
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-6">
          <label className="label">Titre de l'offre *</label>
          <input name="title" defaultValue={initial?.title ?? ""} required className="input" />
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Mode *</label>
          <select name="mode" defaultValue={initial?.mode ?? "PROJECT"} className="input" disabled={!!initial?.id}>
            <option value="PROJECT">Projet (forfait)</option>
            <option value="CONSULTING">Consultance (T&amp;M)</option>
          </select>
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Probabilité (%)</label>
          <input name="probability" type="number" min={0} max={100} defaultValue={initial?.probability ?? 50} className="input" />
        </div>
        <div className="col-span-6 md:col-span-2">
          <label className="label">Statut</label>
          <select name="status" defaultValue={initial?.status ?? "DRAFT"} className="input">
            <option value="DRAFT">Brouillon</option>
            <option value="SENT">Envoyée</option>
            <option value="NEGOTIATION">En négociation</option>
          </select>
          {/* Les transitions terminales (Gagnée/Perdue/Annulée) passent par
              les boutons dédiés en haut de la fiche, pas par le formulaire. */}
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Client *</label>
          <select name="companyId" defaultValue={initial?.companyId ?? ""} required className="input">
            <option value="">— Sélectionner —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-12 md:col-span-6">
          <label className="label">Responsable commercial</label>
          <select name="ownerId" defaultValue={initial?.ownerId ?? initialOwnerId ?? ""} className="input">
            <option value="">— Aucun —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Date d'envoi</label>
          <input name="sentAt" type="date" defaultValue={dateInput(initial?.sentAt)} className="input" />
        </div>
        <div className="col-span-6 md:col-span-3">
          <label className="label">Décision prévue le</label>
          <input name="expectedDecisionAt" type="date" defaultValue={dateInput(initial?.expectedDecisionAt)} className="input" />
        </div>
        <div className="col-span-12">
          <label className="label">Description</label>
          <textarea name="description" defaultValue={initial?.description ?? ""} className="input min-h-[100px] py-2" />
        </div>
        <div className="col-span-12">
          <label className="label">Commentaires internes</label>
          <textarea name="comments" defaultValue={initial?.comments ?? ""} className="input min-h-[80px] py-2" />
        </div>
      </div>
      <div className="flex justify-end">
        <button disabled={pending || readOnly} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer l'offre"}</button>
      </div>
      </fieldset>
    </form>
  );
}
