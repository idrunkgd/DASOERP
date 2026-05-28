"use client";
import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, Plus, ExternalLink, Mail, Phone, Briefcase, Headset, FolderKanban } from "lucide-react";
import { createOpportunity } from "@/server/actions/opportunities";

type Company = { id: string; name: string };
type Contact = {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
};
type Owner = { id: string; firstName: string; lastName: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  COMMERCIAL: "Commercial",
  CONSULTANT: "Consultant",
  FINANCE: "Finance"
};

export function NewOpportunityForm({
  companies,
  contacts,
  owners,
  defaultOwnerId
}: {
  companies: Company[];
  contacts: Contact[];
  owners: Owner[];
  defaultOwnerId: string;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"CONSULTING" | "PROJECT">("CONSULTING");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");

  // Contacts filtrés par société sélectionnée
  const eligibleContacts = useMemo(
    () => contacts.filter((c) => !companyId || c.companyId === companyId),
    [contacts, companyId]
  );

  // Contact actuellement sélectionné (pour afficher email/tel/fonction)
  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  function submit(formData: FormData) {
    start(async () => {
      try {
        await createOpportunity(formData);
        toast.success("Affaire créée");
        setOpen(false);
        setKind("CONSULTING");
        setCompanyId("");
        setContactId("");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary text-sm">
        <Plus className="w-4 h-4" />
        Ajouter une affaire
      </button>
    );
  }

  return (
    <form action={submit} className="grid md:grid-cols-2 gap-3">
      {/* Type d'opportunité — choix obligatoire entre Consultance et Projet */}
      <div className="md:col-span-2">
        <label className="label">
          Type <span className="text-red-600">*</span>
        </label>
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
              kind === "CONSULTING"
                ? "border-blue-500 bg-blue-50 text-blue-800"
                : "border-midnight-200 bg-white hover:border-blue-300"
            }`}
          >
            <input
              type="radio"
              name="kindRadio"
              value="CONSULTING"
              checked={kind === "CONSULTING"}
              onChange={() => setKind("CONSULTING")}
              className="sr-only"
            />
            <Headset className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">Consultance (T&M)</span>
          </label>
          <label
            className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
              kind === "PROJECT"
                ? "border-violet-500 bg-violet-50 text-violet-800"
                : "border-midnight-200 bg-white hover:border-violet-300"
            }`}
          >
            <input
              type="radio"
              name="kindRadio"
              value="PROJECT"
              checked={kind === "PROJECT"}
              onChange={() => setKind("PROJECT")}
              className="sr-only"
            />
            <FolderKanban className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium">Projet (forfait)</span>
          </label>
        </div>
      </div>

      <div className="md:col-span-2">
        <label className="label">Titre</label>
        <input name="title" className="input" required placeholder="ex: Refonte intranet ACME" />
      </div>

      {/* Société — obligatoire, dropdown uniquement */}
      <div>
        <label className="label">
          Société <span className="text-red-600">*</span>
        </label>
        <select
          name="companyId"
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setContactId(""); // reset contact si on change de société
          }}
          className="input"
          required
        >
          <option value="">— Sélectionne une société —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Link
          href="/companies/new"
          target="_blank"
          className="text-[11px] text-indigoaccent hover:underline inline-flex items-center gap-0.5 mt-1"
        >
          <ExternalLink className="w-3 h-3" />
          Société absente ? La créer d'abord
        </Link>
      </div>

      {/* Contact référent — optionnel mais filtré par société */}
      <div>
        <label className="label">Contact référent</label>
        <select
          name="contactId"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="input"
          disabled={!companyId}
        >
          <option value="">{companyId ? "— Aucun —" : "Sélectionne d'abord la société"}</option>
          {eligibleContacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.lastName} {c.firstName}
              {c.jobTitle ? ` · ${c.jobTitle}` : ""}
            </option>
          ))}
        </select>
        {companyId && (
          <Link
            href={`/contacts/new?companyId=${companyId}`}
            target="_blank"
            className="text-[11px] text-indigoaccent hover:underline inline-flex items-center gap-0.5 mt-1"
          >
            <ExternalLink className="w-3 h-3" />
            Contact absent ? Le créer
          </Link>
        )}
      </div>

      {/* Email/téléphone/fonction du contact sélectionné — auto, read-only */}
      {selectedContact && (
        <div className="md:col-span-2 bg-midnight-50 rounded p-2 text-xs flex flex-wrap gap-x-4 gap-y-1">
          {selectedContact.email && (
            <span className="flex items-center gap-1">
              <Mail className="w-3 h-3 text-midnight-400" />
              <a href={`mailto:${selectedContact.email}`} className="hover:underline">
                {selectedContact.email}
              </a>
            </span>
          )}
          {selectedContact.phone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-midnight-400" />
              <a href={`tel:${selectedContact.phone}`} className="hover:underline">
                {selectedContact.phone}
              </a>
            </span>
          )}
          {selectedContact.jobTitle && (
            <span className="flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-midnight-400" />
              {selectedContact.jobTitle}
            </span>
          )}
          {!selectedContact.email && !selectedContact.phone && (
            <span className="text-midnight-400 italic">
              Aucun email/téléphone enregistré pour ce contact —{" "}
              <Link
                href={`/contacts/${selectedContact.id}`}
                target="_blank"
                className="text-indigoaccent hover:underline"
              >
                compléter sa fiche
              </Link>
            </span>
          )}
        </div>
      )}

      {/* Source + Owner */}
      <div>
        <label className="label">Source</label>
        <input name="source" className="input" placeholder="LinkedIn, reco, salon…" />
      </div>
      <div>
        <label className="label">Owner</label>
        <select name="ownerId" defaultValue={defaultOwnerId} className="input">
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.firstName} {o.lastName} — {ROLE_LABEL[o.role] ?? o.role}
            </option>
          ))}
        </select>
      </div>

      {/* Valeur + Probabilité + Date */}
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
      <div />

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
