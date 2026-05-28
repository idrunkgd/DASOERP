"use client";
// Édition des métadonnées d'un document.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDocumentMeta } from "@/server/actions/documents";

type Doc = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  expiresAt: string | null;
  companyId: string | null;
  projectId: string | null;
  offerId: string | null;
  consultantId: string | null;
};

export function DocumentMetaForm({
  document: doc,
  companies,
  projects,
  offers,
  consultants
}: {
  document: Doc;
  companies: { id: string; name: string }[];
  projects: { id: string; name: string; reference: string }[];
  offers: { id: string; title: string; reference: string }[];
  consultants: { id: string; firstName: string; lastName: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <form
      action={(fd) => {
        setError(null);
        start(async () => {
          try {
            await updateDocumentMeta(doc.id, fd);
            router.refresh();
          } catch (e: any) {
            setError(e?.message || "Erreur");
          }
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-midnight-700">
            Titre <span className="text-red-600">*</span>
          </label>
          <input
            name="title"
            defaultValue={doc.title}
            required
            maxLength={200}
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">Tags (CSV)</label>
          <input
            name="tags"
            defaultValue={doc.tags.join(", ")}
            placeholder="Contrat, NDA, RH"
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">Expiration</label>
          <input
            name="expiresAt"
            type="date"
            defaultValue={doc.expiresAt ?? ""}
            className="input mt-1"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">Description</label>
          <input
            name="description"
            defaultValue={doc.description ?? ""}
            maxLength={500}
            className="input mt-1"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3 border-midnight-100">
        <div>
          <label className="text-xs font-medium text-midnight-700">Entreprise</label>
          <select name="companyId" defaultValue={doc.companyId ?? ""} className="input mt-1">
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">Projet</label>
          <select name="projectId" defaultValue={doc.projectId ?? ""} className="input mt-1">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.reference} — {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">Offre</label>
          <select name="offerId" defaultValue={doc.offerId ?? ""} className="input mt-1">
            <option value="">—</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>{o.reference} — {o.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-midnight-700">Consultant</label>
          <select name="consultantId" defaultValue={doc.consultantId ?? ""} className="input mt-1">
            <option value="">—</option>
            {consultants.map((u) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
