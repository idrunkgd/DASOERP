"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  submitExpenseReport,
  approveExpenseReport,
  markExpensePaid,
  deleteExpenseReport
} from "@/server/actions/expense-reports";
import { Send, Check, X, Wallet, Trash2, Pencil, FileDown, Eye } from "lucide-react";

export function ExpenseActions({
  id,
  status,
  canApprove,
  canMarkPaid,
  isOwner
}: {
  id: string;
  status: string;
  canApprove: boolean;
  canMarkPaid: boolean;
  isOwner: boolean;
}) {
  const [pending, start] = useTransition();
  function run(fn: () => Promise<any>, ok = "Mis à jour") {
    start(async () => {
      try {
        await fn();
        toast.success(ok);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }
  return (
    <div className="flex items-center gap-1">
      {status === "DRAFT" && isOwner && (
        <a
          href={`/expenses?edit=${id}#expense-form`}
          className="text-midnight-600 hover:bg-midnight-100 rounded p-1"
          title="Modifier"
        >
          <Pencil className="w-4 h-4" />
        </a>
      )}
      {status === "DRAFT" && isOwner && (
        <button
          className="text-amber-700 hover:bg-amber-50 rounded p-1"
          title="Soumettre pour approbation"
          disabled={pending}
          onClick={() => run(() => submitExpenseReport(id), "Note soumise")}
        >
          <Send className="w-4 h-4" />
        </button>
      )}
      {status === "SUBMITTED" && canApprove && (
        <>
          <button
            className="text-emerald-700 hover:bg-emerald-50 rounded p-1"
            title="Approuver"
            disabled={pending}
            onClick={() => run(() => approveExpenseReport(id, true), "Note approuvée")}
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            className="text-red-700 hover:bg-red-50 rounded p-1"
            title="Refuser"
            disabled={pending}
            onClick={() => {
              const reason = prompt("Motif du refus ?");
              if (reason !== null) run(() => approveExpenseReport(id, false, reason), "Refusée");
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
      {status === "APPROVED" && canMarkPaid && (
        <button
          className="text-indigoaccent hover:bg-indigoaccent/10 rounded p-1"
          title="Marquer comme remboursée"
          disabled={pending}
          onClick={() => run(() => markExpensePaid(id), "Remboursée")}
        >
          <Wallet className="w-4 h-4" />
        </button>
      )}
      {/* Aperçu PDF — ouvre inline dans un nouvel onglet (avant impression / envoi) */}
      <a
        href={`/api/exports/expense-pdf?id=${id}&inline=1`}
        target="_blank"
        rel="noreferrer"
        className="text-midnight-500 hover:bg-midnight-100 rounded p-1"
        title="Aperçu PDF"
      >
        <Eye className="w-4 h-4" />
      </a>
      {/* Téléchargement PDF pour le comptable */}
      <a
        href={`/api/exports/expense-pdf?id=${id}`}
        target="_blank"
        rel="noreferrer"
        className="text-midnight-500 hover:bg-midnight-100 rounded p-1"
        title="Télécharger en PDF (pour le comptable)"
      >
        <FileDown className="w-4 h-4" />
      </a>
      {(isOwner || canMarkPaid || canApprove) && (
        <button
          className="text-midnight-400 hover:text-red-600 hover:bg-red-50 rounded p-1"
          title="Supprimer"
          disabled={pending}
          onClick={() => {
            if (confirm("Supprimer cette note ?")) run(() => deleteExpenseReport(id), "Supprimée");
          }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
