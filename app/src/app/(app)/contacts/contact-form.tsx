"use client";
import { useTransition } from "react";
import { createContact, updateContact } from "@/server/actions/contacts";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Initial = {
  id?: string;
  firstName?: string; lastName?: string; email?: string | null;
  phone?: string | null; jobTitle?: string | null; status?: string;
  notes?: string | null; tags?: string[];
  companyId?: string | null;
};

export function ContactForm({
  initial, companies, defaultCompanyId
}: { initial?: Initial; companies: { id: string; name: string }[]; defaultCompanyId?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      action={(fd) => start(async () => {
        try {
          if (initial?.id) {
            await updateContact(initial.id, fd);
            toast.success("Contact mis à jour"); router.refresh();
          } else {
            await createContact(fd);
          }
        } catch (e: any) { toast.error(e.message ?? "Erreur"); }
      })}
      className="card p-6 max-w-3xl space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Prénom *</label>
          <input name="firstName" defaultValue={initial?.firstName ?? ""} required className="input" />
        </div>
        <div>
          <label className="label">Nom *</label>
          <input name="lastName" defaultValue={initial?.lastName ?? ""} required className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" defaultValue={initial?.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input name="phone" defaultValue={initial?.phone ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Fonction</label>
          <input name="jobTitle" defaultValue={initial?.jobTitle ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Entreprise</label>
          <select name="companyId" defaultValue={initial?.companyId ?? defaultCompanyId ?? ""} className="input">
            <option value="">— Aucune —</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select name="status" defaultValue={initial?.status ?? "ACTIVE"} className="input">
            <option value="ACTIVE">Actif</option>
            <option value="INACTIVE">Inactif</option>
            <option value="ARCHIVED">Archivé</option>
          </select>
        </div>
        <div>
          <label className="label">Tags (séparés par virgule)</label>
          <input name="tags" defaultValue={(initial?.tags ?? []).join(", ")} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" defaultValue={initial?.notes ?? ""} className="input min-h-[100px] py-2" />
        </div>
      </div>
      <div className="flex justify-end">
        <button disabled={pending} className="btn-primary">{pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}</button>
      </div>
    </form>
  );
}
