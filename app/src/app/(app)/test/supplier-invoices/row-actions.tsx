"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Wallet, Trash2, FileText, Loader2 } from "lucide-react";
import {
  markSupplierInvoicePaid,
  deleteSupplierInvoice
} from "@/server/actions/supplier-invoices";

export function RowActions({
  id,
  status,
  pdfUrl
}: {
  id: string;
  status: string;
  pdfUrl: string | null;
}) {
  const [pending, start] = useTransition();

  function togglePaid() {
    start(async () => {
      try {
        await markSupplierInvoicePaid(id);
        toast.success(status === "PAID" ? "Marquée non payée" : "Marquée payée");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function remove() {
    if (!confirm("Supprimer cette facture ?")) return;
    start(async () => {
      try {
        await deleteSupplierInvoice(id);
        toast.success("Supprimée");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="text-midnight-500 hover:text-indigoaccent p-1"
          title="Voir le PDF"
        >
          <FileText className="w-4 h-4" />
        </a>
      )}
      {status !== "CANCELLED" && (
        <button
          onClick={togglePaid}
          disabled={pending}
          className={`p-1 rounded ${
            status === "PAID"
              ? "text-emerald-700 hover:bg-emerald-50"
              : "text-midnight-500 hover:bg-emerald-50 hover:text-emerald-700"
          }`}
          title={status === "PAID" ? "Annuler le paiement" : "Marquer payée"}
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
        </button>
      )}
      <button
        onClick={remove}
        disabled={pending}
        className="text-midnight-400 hover:text-red-600 hover:bg-red-50 rounded p-1"
        title="Supprimer"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
