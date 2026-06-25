"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { UserPlus, X, Loader2, Users } from "lucide-react";
import { addOfferContact, removeOfferContact } from "@/server/actions/offers";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
};

export function OfferContactsSection({
  offerId,
  companyId,
  linkedContacts,
  availableContacts,
  editable
}: {
  offerId: string;
  companyId: string;
  /// Contacts déjà attachés à l'offre via OfferContact (affichés sur le PDF)
  linkedContacts: Contact[];
  /// Tous les contacts de la company cliente (pour le sélecteur)
  availableContacts: Contact[];
  editable: boolean;
}) {
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState(false);

  const linkedIds = new Set(linkedContacts.map((c) => c.id));
  const pickable = availableContacts.filter((c) => !linkedIds.has(c.id));

  function add(contactId: string) {
    start(async () => {
      try {
        await addOfferContact(offerId, contactId);
        setPicking(false);
        toast.success("Contact ajouté à l'offre");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function remove(contactId: string) {
    start(async () => {
      try {
        await removeOfferContact(offerId, contactId);
        toast.success("Contact retiré");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4" />
          Contacts client liés ({linkedContacts.length})
        </h2>
        {editable && pickable.length > 0 && (
          <button
            onClick={() => setPicking((v) => !v)}
            className="btn-secondary btn-sm"
            disabled={pending}
          >
            <UserPlus className="w-3 h-3" /> Ajouter un contact
          </button>
        )}
      </div>

      {linkedContacts.length === 0 ? (
        <p className="text-sm text-midnight-500">
          Aucun contact lié à cette offre. Ajoutes-en au moins un pour qu'il apparaisse comme destinataire sur le PDF du devis.
        </p>
      ) : (
        <ul className="space-y-2">
          {linkedContacts.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between p-3 border border-border rounded-lg"
            >
              <div>
                <Link
                  href={`/contacts/${c.id}`}
                  className="font-medium text-midnight-900 hover:underline"
                >
                  {c.firstName} {c.lastName}
                </Link>
                {c.jobTitle && (
                  <span className="text-xs text-midnight-500 ml-2">— {c.jobTitle}</span>
                )}
                <div className="text-xs text-midnight-500 mt-0.5 flex gap-3">
                  {c.email && <span>{c.email}</span>}
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </div>
              {editable && (
                <button
                  onClick={() => remove(c.id)}
                  className="text-midnight-400 hover:text-red-600 p-1"
                  title="Retirer ce contact de l'offre"
                  disabled={pending}
                >
                  {pending ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-4 h-4" />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Liste cochable des contacts dispos chez ce client */}
      {picking && pickable.length > 0 && (
        <div className="mt-3 p-3 rounded-lg border border-indigoaccent/20 bg-indigoaccent/5">
          <p className="text-xs font-medium text-midnight-900 mb-2">
            Sélectionne un contact de cette entreprise :
          </p>
          <ul className="space-y-1">
            {pickable.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => add(c.id)}
                  disabled={pending}
                  className="w-full text-left p-2 rounded hover:bg-white text-sm flex items-center justify-between"
                >
                  <span>
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    {c.jobTitle && <span className="text-midnight-500 ml-1">— {c.jobTitle}</span>}
                  </span>
                  <span className="text-xs text-indigoaccent">+ Ajouter</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {picking && pickable.length === 0 && (
        <p className="text-xs text-midnight-500 mt-2">
          Tous les contacts de cette entreprise sont déjà liés à l'offre.
        </p>
      )}

      {!editable && (
        <p className="text-[11px] text-midnight-400 mt-2">
          L'offre est verrouillée — édite-la pour modifier les contacts liés.
        </p>
      )}

      {availableContacts.length === 0 && linkedContacts.length === 0 && (
        <p className="text-xs text-amber-700 mt-2">
          Aucun contact n'existe pour cette entreprise.{" "}
          <Link href={`/companies/${companyId}`} className="underline">
            Crée-en un sur la fiche entreprise
          </Link>{" "}
          puis reviens ici pour le lier.
        </p>
      )}
    </section>
  );
}
