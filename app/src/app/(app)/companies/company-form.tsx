"use client";
import { useTransition } from "react";
import { createCompany, updateCompany } from "@/server/actions/companies";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type Initial = {
  id?: string;
  name?: string; vatNumber?: string | null; website?: string | null;
  sector?: string | null; size?: string | null; status?: string;
  source?: string | null; street?: string | null; city?: string | null;
  postalCode?: string | null; country?: string | null; notes?: string | null;
};

export function CompanyForm({ initial }: { initial?: Initial }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  async function onSubmit(formData: FormData) {
    start(async () => {
      try {
        if (initial?.id) {
          await updateCompany(initial.id, formData);
          toast.success("Entreprise mise à jour");
          router.refresh();
        } else {
          await createCompany(formData);
        }
      } catch (e: any) {
        toast.error(e.message ?? "Erreur");
      }
    });
  }

  return (
    <form action={onSubmit} className="card p-6 max-w-3xl space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Nom de l'entreprise *</label>
          <input name="name" defaultValue={initial?.name ?? ""} required className="input" />
        </div>
        <div>
          <label className="label">N° TVA / BCE</label>
          <input name="vatNumber" defaultValue={initial?.vatNumber ?? ""} className="input" placeholder="BE0123.456.789" />
        </div>
        <div>
          <label className="label">Statut *</label>
          <select name="status" defaultValue={initial?.status ?? "PROSPECT"} className="input">
            <option value="PROSPECT">Prospect</option>
            <option value="CLIENT">Client</option>
            <option value="PARTNER">Partenaire</option>
            <option value="SUPPLIER">Fournisseur</option>
          </select>
        </div>
        <div>
          <label className="label">Secteur</label>
          <input name="sector" defaultValue={initial?.sector ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Taille</label>
          <input name="size" defaultValue={initial?.size ?? ""} className="input" placeholder="ex: 10-50" />
        </div>
        <div>
          <label className="label">Site web</label>
          <input name="website" defaultValue={initial?.website ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Source</label>
          <input name="source" defaultValue={initial?.source ?? ""} className="input" placeholder="ex: LinkedIn, recommandation..." />
        </div>
        <div className="col-span-2">
          <label className="label">Adresse</label>
          <input name="street" defaultValue={initial?.street ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Code postal</label>
          <input name="postalCode" defaultValue={initial?.postalCode ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Ville</label>
          <input name="city" defaultValue={initial?.city ?? ""} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Pays</label>
          <input name="country" defaultValue={initial?.country ?? "Belgique"} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" defaultValue={initial?.notes ?? ""} className="input min-h-[100px] py-2" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "..." : initial?.id ? "Enregistrer" : "Créer"}
        </button>
      </div>
    </form>
  );
}
