"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { moveOpportunityStage, deleteOpportunity } from "@/server/actions/opportunities";
import { ChevronRight, ChevronLeft, X, Trash2, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Stage = "NEW" | "QUALIFIED" | "PROPOSED" | "NEGOTIATING" | "WON" | "LOST";

const STAGE_ORDER: Stage[] = ["NEW", "QUALIFIED", "PROPOSED", "NEGOTIATING", "WON"];

export function OpportunityCard({
  opp
}: {
  opp: {
    id: string;
    title: string;
    stage: Stage;
    estimatedValue: number;
    probability: number;
    companyName: string | null;
    ownerName: string | null;
    expectedCloseAt: string | null;
    lostReason: string | null;
  };
}) {
  const [pending, start] = useTransition();

  function move(newStage: Stage, reason?: string) {
    start(async () => {
      try {
        await moveOpportunityStage(opp.id, newStage, reason);
        toast.success(`→ ${newStage}`);
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  function remove() {
    if (!confirm(`Supprimer l'opportunité « ${opp.title} » ?`)) return;
    start(async () => {
      try {
        await deleteOpportunity(opp.id);
        toast.success("Supprimée");
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur");
      }
    });
  }

  const idx = STAGE_ORDER.indexOf(opp.stage);
  const canForward = idx >= 0 && idx < STAGE_ORDER.length - 1;
  const canBack = idx > 0;
  const isClosed = opp.stage === "WON" || opp.stage === "LOST";

  return (
    <div className="bg-white rounded-md shadow-sm border border-midnight-100 p-2.5 text-xs space-y-1.5">
      <div className="font-medium text-midnight-900">{opp.title}</div>
      {opp.companyName && <div className="text-[11px] text-midnight-600">{opp.companyName}</div>}
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-semibold text-midnight-800">{formatCurrency(opp.estimatedValue)}</span>
        <span className="text-midnight-500">{opp.probability}% proba</span>
      </div>
      {opp.expectedCloseAt && (
        <div className="text-[10px] text-midnight-500">Closing : {opp.expectedCloseAt}</div>
      )}
      {opp.ownerName && <div className="text-[10px] text-midnight-500">Owner : {opp.ownerName}</div>}
      {opp.lostReason && (
        <div className="text-[10px] text-red-600">Perdu : {opp.lostReason}</div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-midnight-100">
        <div className="flex gap-0.5">
          {canBack && (
            <button
              className="p-1 rounded hover:bg-midnight-100 text-midnight-600"
              title={`← ${STAGE_ORDER[idx - 1]}`}
              disabled={pending}
              onClick={() => move(STAGE_ORDER[idx - 1])}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {canForward && (
            <button
              className="p-1 rounded hover:bg-midnight-100 text-midnight-600"
              title={`→ ${STAGE_ORDER[idx + 1]}`}
              disabled={pending}
              onClick={() => move(STAGE_ORDER[idx + 1])}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {!isClosed && (
            <button
              className="p-1 rounded hover:bg-red-50 text-red-600 ml-1"
              title="Marquer comme perdu"
              disabled={pending}
              onClick={() => {
                const r = prompt("Raison de la perte ?");
                if (r !== null) move("LOST", r);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          className="p-1 rounded hover:bg-midnight-100 text-midnight-400"
          title="Supprimer"
          disabled={pending}
          onClick={remove}
        >
          {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
