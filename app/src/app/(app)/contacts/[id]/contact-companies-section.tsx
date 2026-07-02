"use client";
/**
 * Section « Sociétés » sur la fiche contact.
 *
 * Un contact peut être rattaché à plusieurs Company via la table
 * ContactCompany. On expose ici :
 *  - la liste des sociétés liées avec badge « Principale » + rôle par lien,
 *  - un formulaire pour ajouter une société existante (dropdown filtré),
 *  - les actions inline : promouvoir en principale, éditer rôle/notes,
 *    retirer le lien.
 *
 * La société principale est synchronisée côté serveur avec
 * Contact.companyId pour la rétro-compatibilité avec l'ancien code.
 */
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Building2, Plus, Star, StarOff, X, Pencil, Save, Loader2 } from "lucide-react";
import {
  linkContactToCompany,
  unlinkContactFromCompany,
  setPrimaryContactCompany,
  updateContactCompanyLink
} from "@/server/actions/contact-companies";

type Link = {
  companyId: string;
  companyName: string;
  companyCity: string | null;
  jobTitle: string | null;
  notes: string | null;
  isPrimary: boolean;
};

export function ContactCompaniesSection({
  contactId, links, availableCompanies
}: {
  contactId: string;
  links: Link[];
  availableCompanies: { id: string; name: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  const linkedIds = useMemo(() => new Set(links.map((l) => l.companyId)), [links]);
  const pickable = useMemo(
    () => availableCompanies.filter((c) => !linkedIds.has(c.id)),
    [availableCompanies, linkedIds]
  );

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Sociétés ({links.length})
        </h2>
        {!adding && pickable.length > 0 && (
          <button
            onClick={() => setAdding(true)}
            className="btn-secondary btn-sm"
          >
            <Plus className="w-3 h-3" /> Ajouter une société
          </button>
        )}
      </div>

      {adding && (
        <AddLinkForm
          contactId={contactId}
          companies={pickable}
          hasPrimary={links.some((l) => l.isPrimary)}
          onDone={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      )}

      {links.length === 0 ? (
        <p className="text-sm text-midnight-500 mt-2">
          Aucune société rattachée. Utilise « Ajouter une société » pour rattacher ce contact à une ou plusieurs entreprises.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) =>
            editingCompanyId === l.companyId ? (
              <EditLinkRow
                key={l.companyId}
                contactId={contactId}
                link={l}
                onDone={() => setEditingCompanyId(null)}
                onCancel={() => setEditingCompanyId(null)}
              />
            ) : (
              <LinkRow
                key={l.companyId}
                contactId={contactId}
                link={l}
                onEdit={() => setEditingCompanyId(l.companyId)}
              />
            )
          )}
        </ul>
      )}

      {pickable.length === 0 && links.length > 0 && (
        <p className="text-[11px] text-midnight-400 mt-3">
          Toutes les sociétés existantes sont déjà rattachées. Crée-en une nouvelle depuis <Link href="/companies/new" className="underline">/companies/new</Link>.
        </p>
      )}
    </section>
  );
}

function LinkRow({
  contactId, link, onEdit
}: {
  contactId: string;
  link: Link;
  onEdit: () => void;
}) {
  const [pending, start] = useTransition();

  function promote() {
    start(async () => {
      try {
        await setPrimaryContactCompany(contactId, link.companyId);
        toast.success(`${link.companyName} définie comme société principale`);
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  function unlink() {
    if (!confirm(`Retirer le rattachement à « ${link.companyName} » ?`)) return;
    start(async () => {
      try {
        await unlinkContactFromCompany(contactId, link.companyId);
        toast.success("Rattachement retiré");
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }

  return (
    <li className={"p-3 border rounded-lg " + (link.isPrimary ? "border-indigoaccent/40 bg-indigoaccent/5" : "border-border")}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/companies/${link.companyId}`} className="font-medium text-midnight-900 hover:underline">
              {link.companyName}
            </Link>
            {link.isPrimary && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigoaccent text-white rounded inline-flex items-center gap-1">
                <Star className="w-2.5 h-2.5" /> Principale
              </span>
            )}
            {link.companyCity && (
              <span className="text-xs text-midnight-500">{link.companyCity}</span>
            )}
          </div>
          {link.jobTitle && (
            <div className="text-xs text-midnight-700 mt-0.5">
              {link.jobTitle}
            </div>
          )}
          {link.notes && (
            <div className="text-xs text-midnight-500 mt-0.5 italic">{link.notes}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!link.isPrimary && (
            <button
              onClick={promote} disabled={pending}
              className="p-1.5 text-midnight-400 hover:text-indigoaccent"
              title="Définir comme société principale"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <StarOff className="w-4 h-4" />}
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-midnight-400 hover:text-midnight-900" title="Modifier le rôle">
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={unlink} disabled={pending}
            className="p-1.5 text-midnight-400 hover:text-red-600"
            title="Retirer ce rattachement"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </li>
  );
}

function EditLinkRow({
  contactId, link, onDone, onCancel
}: {
  contactId: string;
  link: Link;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    jobTitle: link.jobTitle ?? "",
    notes: link.notes ?? ""
  });
  function save(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("jobTitle", form.jobTitle);
    fd.set("notes", form.notes);
    start(async () => {
      try {
        await updateContactCompanyLink(contactId, link.companyId, fd);
        toast.success("Rôle mis à jour");
        onDone();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  return (
    <li className="p-3 border-2 border-indigoaccent rounded-lg bg-white">
      <div className="text-sm font-medium mb-2">
        {link.companyName}
        {link.isPrimary && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigoaccent text-white rounded ml-2">Principale</span>}
      </div>
      <form onSubmit={save} className="space-y-2">
        <input
          className="input" placeholder="Rôle / fonction dans cette société"
          value={form.jobTitle}
          onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
        />
        <input
          className="input" placeholder="Notes (optionnel)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="btn-ghost btn-sm">Annuler</button>
          <button type="submit" disabled={pending} className="btn-primary btn-sm">
            {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Enregistrer
          </button>
        </div>
      </form>
    </li>
  );
}

function AddLinkForm({
  contactId, companies, hasPrimary, onDone, onCancel
}: {
  contactId: string;
  companies: { id: string; name: string }[];
  hasPrimary: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    companyId: companies[0]?.id ?? "",
    jobTitle: "",
    notes: "",
    // Si le contact n'a AUCUNE société principale (nouveau contact),
    // on coche par défaut. Sinon on laisse à l'utilisateur.
    makePrimary: !hasPrimary
  });
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyId) { toast.error("Choisis une société"); return; }
    const fd = new FormData();
    fd.set("contactId", contactId);
    fd.set("companyId", form.companyId);
    fd.set("jobTitle", form.jobTitle);
    fd.set("notes", form.notes);
    if (form.makePrimary) fd.set("makePrimary", "on");
    start(async () => {
      try {
        await linkContactToCompany(fd);
        toast.success("Société rattachée");
        onDone();
      } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    });
  }
  return (
    <form onSubmit={submit} className="p-3 border-2 border-indigoaccent rounded-lg bg-white mb-3 space-y-2">
      <select
        className="input"
        value={form.companyId}
        onChange={(e) => setForm({ ...form, companyId: e.target.value })}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <input
        className="input" placeholder="Rôle / fonction dans cette société (optionnel)"
        value={form.jobTitle}
        onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
      />
      <input
        className="input" placeholder="Notes (optionnel)"
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.makePrimary}
          onChange={(e) => setForm({ ...form, makePrimary: e.target.checked })}
        />
        Définir comme société principale
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">Annuler</button>
        <button type="submit" disabled={pending} className="btn-primary btn-sm">
          {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Rattacher
        </button>
      </div>
    </form>
  );
}
