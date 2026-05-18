"use client";
import { useState, useTransition } from "react";
import { Wallet, Pencil, Save, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertCashflowSettings } from "@/server/actions/cashflow";
import { formatCurrency } from "@/lib/utils";

/**
 * KPI cliquable pour le solde initial. Clic → affiche un mini-éditeur
 * inline qui permet de saisir directement le nouveau montant + la date.
 */
export function EditableBalanceKpi({
  initialBalance,
  startingDate
}: {
  initialBalance: number;
  startingDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<string>(String(initialBalance));
  const [date, setDate] = useState<string>(startingDate);
  const [pending, start] = useTransition();

  function save() {
    const fd = new FormData();
    fd.set("startingBalance", balance || "0");
    fd.set("startingDate", date);
    start(async () => {
      try {
        await upsertCashflowSettings(fd);
        toast.success("Solde initial mis à jour");
        setOpen(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  if (open) {
    return (
      <div className="card p-5 border-indigoaccent/40 bg-indigoaccent/5">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wide text-midnight-500">
            Solde initial
          </span>
          <button
            onClick={() => setOpen(false)}
            className="text-midnight-400 hover:text-midnight-700"
            disabled={pending}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <input
          type="number"
          step="0.01"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className="input w-full text-lg font-semibold tabular-nums text-right"
          autoFocus
          disabled={pending}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input w-full text-xs mt-1"
          disabled={pending}
        />
        <button
          onClick={save}
          disabled={pending}
          className="btn-primary w-full mt-2 text-xs"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {pending ? "Sauvegarde…" : "Enregistrer"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="card p-5 text-left hover:border-indigoaccent/40 hover:shadow-md transition group cursor-pointer w-full"
      title="Cliquer pour modifier"
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-midnight-500">
          Solde initial
        </span>
        <Pencil className="w-3.5 h-3.5 text-midnight-300 group-hover:text-indigoaccent" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-midnight-900">
        {formatCurrency(initialBalance)}
      </div>
      <div className="text-xs text-midnight-500 mt-1">
        au {startingDate}
      </div>
    </button>
  );
}
