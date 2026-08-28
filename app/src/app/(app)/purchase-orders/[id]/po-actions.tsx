"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Mail, CheckCircle2, Truck, XCircle, RotateCcw, Trash2 } from "lucide-react";
import { markPoSent, changePoStatus, deletePurchaseOrder } from "@/server/actions/purchase-orders";
import { isNextControlFlow } from "@/lib/next-errors";

/**
 * Actions statut + envoi email d'un PO.
 * L'envoi passe par un mailto: pré-rempli (destinataire, sujet, corps).
 * L'user attache lui-même le PDF (téléchargé automatiquement juste avant).
 */
export function PoActions({
  id,
  reference,
  title,
  status,
  contactEmail,
  contactName,
  senderName,
  totalTtc,
  currency,
  pdfUrl
}: {
  id: string;
  reference: string;
  title: string;
  status: string;
  contactEmail: string | null;
  contactName: string | null;
  senderName: string;
  totalTtc: number;
  currency: string;
  pdfUrl: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  async function sendByMail() {
    if (!contactEmail) {
      toast.error("Aucun email de contact fournisseur — renseigne-le avant d'envoyer.");
      return;
    }
    start(async () => {
      try {
        // 1. Ouvre le PDF pour téléchargement (l'user pourra l'attacher)
        window.open(pdfUrl, "_blank");
        // 2. Marque le PO comme SENT côté serveur
        await markPoSent(id);
        // 3. Ouvre le client mail natif avec un brouillon pré-rempli
        const greeting = contactName ? `Bonjour ${contactName},` : "Bonjour,";
        const body = [
          greeting,
          "",
          `Vous trouverez ci-joint notre bon de commande ${reference} pour un montant de ${totalTtc.toFixed(2)} ${currency} TTC.`,
          "",
          "Merci de bien vouloir confirmer sa bonne réception ainsi que la date de livraison.",
          "",
          "Bien à vous,",
          senderName,
          "Dasolabs"
        ].join("\n");
        const subject = `Bon de commande ${reference} — ${title}`;
        const mailto = `mailto:${encodeURIComponent(contactEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
        toast.success("PO marqué comme envoyé — attache le PDF téléchargé");
        router.refresh();
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function change(target: string, ask?: string) {
    let reason: string | undefined;
    if (ask) {
      const r = window.prompt(ask);
      if (r == null) return;
      reason = r || undefined;
    }
    start(async () => {
      try {
        await changePoStatus(id, target, reason);
        toast.success("Statut mis à jour");
        router.refresh();
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function del() {
    if (!confirm(`Supprimer définitivement le PO ${reference} ?`)) return;
    start(async () => {
      try {
        await deletePurchaseOrder(id);
        toast.success("Supprimé");
        router.push("/purchase-orders");
      } catch (e: any) {
        if (isNextControlFlow(e)) throw e;
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "DRAFT" && (
        <>
          <button onClick={sendByMail} disabled={pending} className="btn-primary btn-sm text-xs">
            <Mail className="w-3.5 h-3.5" /> Envoyer par email
          </button>
          <button onClick={del} disabled={pending} className="btn-secondary btn-sm text-xs text-rose-700">
            <Trash2 className="w-3.5 h-3.5" /> Supprimer
          </button>
        </>
      )}
      {status === "SENT" && (
        <>
          <button onClick={() => change("ACKNOWLEDGED")} disabled={pending} className="btn-primary btn-sm text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" /> Marquer confirmé
          </button>
          <button onClick={() => change("DRAFT")} disabled={pending} className="btn-secondary btn-sm text-xs">
            <RotateCcw className="w-3.5 h-3.5" /> Repasser en brouillon
          </button>
        </>
      )}
      {(status === "SENT" || status === "ACKNOWLEDGED") && (
        <button onClick={() => change("RECEIVED")} disabled={pending} className="btn-primary btn-sm text-xs">
          <Truck className="w-3.5 h-3.5" /> Marquer reçu
        </button>
      )}
      {status !== "CANCELLED" && status !== "RECEIVED" && (
        <button onClick={() => change("CANCELLED", "Motif d'annulation :")} disabled={pending} className="btn-secondary btn-sm text-xs text-rose-700">
          <XCircle className="w-3.5 h-3.5" /> Annuler
        </button>
      )}
    </div>
  );
}
