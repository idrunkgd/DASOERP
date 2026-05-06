"use client";
import { useTransition } from "react";
import {
  setOfferStatus, duplicateOfferAction, deleteOfferAction,
  createComplementAction, createNewVersionAction
} from "@/server/actions/offers";
import { toast } from "sonner";
import Link from "next/link";

const TRANSITIONS: Record<string, { value: string; label: string }[]> = {
  DRAFT:       [{ value: "SENT", label: "Marquer envoyée" }, { value: "CANCELLED", label: "Annuler" }],
  SENT:        [{ value: "NEGOTIATION", label: "Passer en négociation" }, { value: "WON", label: "Marquer gagnée" }, { value: "LOST", label: "Marquer perdue" }, { value: "CANCELLED", label: "Annuler" }],
  NEGOTIATION: [{ value: "WON", label: "Marquer gagnée" }, { value: "LOST", label: "Marquer perdue" }, { value: "CANCELLED", label: "Annuler" }],
  WON:         [],
  LOST:        [],
  CANCELLED:   []
};

export function OfferActions({ offer }: { offer: { id: string; status: string; projectId: string | null; isComplement?: boolean; hasNextVersion?: boolean } }) {
  const [pending, start] = useTransition();
  const opts = TRANSITIONS[offer.status] ?? [];
  const isFinal = ["WON", "LOST", "CANCELLED"].includes(offer.status);
  const isLocked = offer.status !== "DRAFT";
  const canVersion = (offer.status === "SENT" || offer.status === "NEGOTIATION") && !offer.hasNextVersion;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {offer.projectId && <Link href={`/projects/${offer.projectId}`} className="btn-secondary btn-sm">Voir le projet</Link>}

      {/* Nouvelle version : seulement pour SENT/NEGOTIATION */}
      {canVersion && (
        <button
          disabled={pending}
          onClick={() => { if (window.confirm("Créer une nouvelle version (V+1) ? L'offre actuelle restera consultable mais figée.")) start(async () => { try { await createNewVersionAction(offer.id); } catch (e: any) { toast.error(e.message); } }); }}
          className="btn-primary btn-sm"
        >+ Nouvelle version</button>
      )}

      {/* Complément : pas pour les compléments eux-mêmes ni pour les statuts terminaux */}
      {!offer.isComplement && !isFinal && offer.status !== "DRAFT" && (
        <button
          disabled={pending}
          onClick={() => { if (window.confirm("Créer un complément à cette offre ?")) start(async () => { try { await createComplementAction(offer.id); } catch (e: any) { toast.error(e.message); } }); }}
          className="btn-secondary btn-sm"
        >+ Complément</button>
      )}

      {opts.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const confirmMsg = v === "WON"
              ? "Confirmer ? Un projet sera créé automatiquement, les tranches y seront rattachées et l'offre sera figée définitivement."
              : v === "LOST" ? "Marquer cette offre comme perdue ? Elle deviendra figée."
              : v === "SENT" ? "Marquer comme envoyée ? Toute modification ultérieure devra passer par une nouvelle version."
              : `Changer le statut vers "${v}" ?`;
            if (!window.confirm(confirmMsg)) { e.target.value = ""; return; }
            start(async () => {
              try { await setOfferStatus(offer.id, v as any); toast.success("Statut mis à jour"); }
              catch (err: any) { toast.error(err.message); }
            });
            e.target.value = "";
          }}
          className="input h-9 text-sm w-[230px]"
        >
          <option value="">Changer de statut...</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      <button
        disabled={pending}
        onClick={() => start(async () => { await duplicateOfferAction(offer.id); })}
        className="btn-secondary btn-sm"
      >Dupliquer</button>

      {/* Suppression : autorisée sauf WON */}
      {offer.status !== "WON" && (
        <button
          onClick={() => { if (window.confirm("Supprimer cette offre ?")) start(async () => { try { await deleteOfferAction(offer.id); } catch (e: any) { toast.error(e.message); } }); }}
          className="btn-danger btn-sm"
        >Supprimer</button>
      )}
    </div>
  );
}
