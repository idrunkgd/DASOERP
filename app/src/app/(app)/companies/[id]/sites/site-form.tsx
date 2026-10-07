/**
 * Formulaire création/édition d'un site d'entreprise (CompanySite).
 */
import { SubmitButton } from "@/components/ui/submit-button";
import Link from "next/link";

type SiteInitial = {
  id?: string;
  name?: string;
  siteType?: string | null;
  street?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  establishmentUnit?: string | null;
  verificationStatus?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  isPrimary?: boolean;
};

export function SiteForm({
  action,
  initial,
  companyId
}: {
  action: (fd: FormData) => Promise<void>;
  initial?: SiteInitial;
  companyId: string;
}) {
  return (
    <form action={action} className="card p-6 max-w-3xl space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Nom du site *</label>
          <input name="name" required defaultValue={initial?.name ?? ""} className="input"
                 placeholder="Fleurus, Siège social, Dépôt Nord…" />
        </div>
        <div>
          <label className="label">Type</label>
          <select name="siteType" defaultValue={initial?.siteType ?? ""} className="input">
            <option value="">—</option>
            <option value="Siège">Siège</option>
            <option value="Usine">Usine</option>
            <option value="Usine / siège">Usine / siège</option>
            <option value="Production">Production</option>
            <option value="Dépôt">Dépôt</option>
            <option value="Bureau">Bureau</option>
            <option value="À identifier">À identifier</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Rue / numéro</label>
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
        <div>
          <label className="label">Pays</label>
          <input name="country" defaultValue={initial?.country ?? "Belgique"} className="input" />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input name="phone" defaultValue={initial?.phone ?? ""} className="input"
                 placeholder="+32 ..." />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" defaultValue={initial?.email ?? ""} className="input" />
        </div>
        <div>
          <label className="label">N° unité d'établissement (BCE)</label>
          <input name="establishmentUnit" defaultValue={initial?.establishmentUnit ?? ""} className="input"
                 placeholder="2.xxx.xxx.xxx" />
        </div>
        <div>
          <label className="label">Statut de vérification</label>
          <select name="verificationStatus" defaultValue={initial?.verificationStatus ?? ""} className="input">
            <option value="">—</option>
            <option value="Documenté">Documenté</option>
            <option value="Partiel">Partiel</option>
            <option value="À confirmer">À confirmer</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">URL source</label>
          <input name="sourceUrl" type="url" defaultValue={initial?.sourceUrl ?? ""} className="input"
                 placeholder="https://..." />
        </div>
        <div className="md:col-span-2">
          <label className="label">Notes</label>
          <textarea name="notes" rows={3} defaultValue={initial?.notes ?? ""} className="input" />
        </div>
        <div className="md:col-span-2 flex items-center gap-2">
          <input id="isPrimary" name="isPrimary" type="checkbox" defaultChecked={!!initial?.isPrimary} />
          <label htmlFor="isPrimary" className="text-sm text-midnight-700">
            Site principal (siège) — un seul par société
          </label>
        </div>
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-border">
        <Link href={`/companies/${companyId}`} className="btn-ghost">Annuler</Link>
        <SubmitButton pendingLabel="Sauvegarde…">
          {initial?.id ? "Enregistrer les modifications" : "Créer le site"}
        </SubmitButton>
      </div>
    </form>
  );
}
