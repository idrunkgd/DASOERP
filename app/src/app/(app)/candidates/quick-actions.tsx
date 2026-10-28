"use client";
/**
 * Mini-dropdown pour changer le statut d'un candidat depuis la liste
 * sans ouvrir sa fiche. Visible au hover sur la tuile ou toujours visible
 * en vue liste.
 */
import { useState, useTransition } from "react";
import { setCandidateStatus } from "@/server/actions/candidates";
import { Check, X, Archive, UserCheck, MoreVertical } from "lucide-react";
import { toast } from "sonner";

type Status = "ACTIVE" | "UNAVAILABLE" | "ENGAGED" | "ARCHIVED";

const OPTIONS: { value: Status; label: string; icon: any; cls: string }[] = [
  { value: "ACTIVE",      label: "Disponible",   icon: Check,     cls: "text-emerald-600" },
  { value: "UNAVAILABLE", label: "Indisponible", icon: X,         cls: "text-amber-600" },
  { value: "ENGAGED",     label: "En mission",   icon: UserCheck, cls: "text-indigoaccent" },
  { value: "ARCHIVED",    label: "Archiver",     icon: Archive,   cls: "text-midnight-500" }
];

export function CandidateQuickActions({
  id,
  current,
  compact = false
}: {
  id: string;
  current: Status;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function change(next: Status) {
    if (next === current) { setOpen(false); return; }
    start(async () => {
      try {
        await setCandidateStatus(id, next);
        toast.success(`Statut → ${OPTIONS.find(o => o.value === next)?.label}`);
        setOpen(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Échec du changement");
      }
    });
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen(v => !v); }}
        disabled={pending}
        className={
          "rounded-md border border-border bg-white hover:bg-midnight-50 " +
          (compact
            ? "p-1 inline-flex items-center justify-center"
            : "px-2 py-1 text-xs font-medium inline-flex items-center gap-1")
        }
        title="Changer le statut"
      >
        <MoreVertical className={compact ? "w-3.5 h-3.5" : "w-3 h-3"} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-white border border-border rounded-lg shadow-lg py-1">
            {OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isCurrent = opt.value === current;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={(e) => { e.preventDefault(); change(opt.value); }}
                  disabled={pending || isCurrent}
                  className={
                    "w-full flex items-center gap-2 px-3 py-2 text-xs text-left " +
                    (isCurrent
                      ? "bg-midnight-50 text-midnight-400 cursor-default"
                      : "hover:bg-midnight-50 text-midnight-900")
                  }
                >
                  <Icon className={"w-3.5 h-3.5 " + opt.cls} />
                  <span>{opt.label}</span>
                  {isCurrent && <span className="ml-auto text-[9px] text-midnight-400">actuel</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
