"use client";
/**
 * Bouton "📄 PDF" avec popover date-range.
 *
 * Pré-remplit avec la semaine courante par défaut. Boutons preset :
 * cette semaine, semaine dernière, ce mois, mois dernier, personnalisé.
 * Clique final → ouvre le PDF dans un nouvel onglet (?inline=1).
 */
import { useState, useRef, useEffect } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, subMonths, subWeeks } from "date-fns";
import { FileDown } from "lucide-react";

export function PdfExportButton({
  weekStartISO,
  onBehalfOfUserId
}: {
  weekStartISO: string;
  onBehalfOfUserId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const weekStart = new Date(weekStartISO);
  const weekEnd = addDays(weekStart, 6);
  const [from, setFrom] = useState(format(weekStart, "yyyy-MM-dd"));
  const [to, setTo] = useState(format(weekEnd, "yyyy-MM-dd"));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function preset(kind: "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth") {
    const today = new Date();
    if (kind === "thisWeek") {
      setFrom(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setTo(format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (kind === "lastWeek") {
      const lw = subWeeks(today, 1);
      setFrom(format(startOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      setTo(format(endOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd"));
    } else if (kind === "thisMonth") {
      setFrom(format(startOfMonth(today), "yyyy-MM-dd"));
      setTo(format(endOfMonth(today), "yyyy-MM-dd"));
    } else if (kind === "lastMonth") {
      const lm = subMonths(today, 1);
      setFrom(format(startOfMonth(lm), "yyyy-MM-dd"));
      setTo(format(endOfMonth(lm), "yyyy-MM-dd"));
    }
  }

  const href = `/api/exports/timesheet-pdf?from=${from}&to=${to}${onBehalfOfUserId ? `&userId=${onBehalfOfUserId}` : ""}&inline=1`;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary"
        title="Exporter en PDF (date de début / date de fin)"
      >
        <FileDown className="w-3.5 h-3.5 mr-1 inline-block" /> PDF
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-[340px] card p-3 shadow-xl bg-white border border-border">
          <div className="text-xs font-mono uppercase tracking-widest text-midnight-500 mb-2">
            Période d'export
          </div>

          {/* Presets */}
          <div className="flex flex-wrap gap-1 mb-3">
            <button type="button" onClick={() => preset("thisWeek")} className="btn-ghost btn-xs text-xs">Cette sem.</button>
            <button type="button" onClick={() => preset("lastWeek")} className="btn-ghost btn-xs text-xs">Sem. dernière</button>
            <button type="button" onClick={() => preset("thisMonth")} className="btn-ghost btn-xs text-xs">Ce mois</button>
            <button type="button" onClick={() => preset("lastMonth")} className="btn-ghost btn-xs text-xs">Mois dernier</button>
          </div>

          {/* Date inputs */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="block">
              <span className="text-[10px] text-midnight-500 uppercase tracking-wider">Du</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="input h-8 w-full text-sm mt-0.5"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-midnight-500 uppercase tracking-wider">Au (inclus)</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input h-8 w-full text-sm mt-0.5"
                min={from}
              />
            </label>
          </div>

          <div className="text-[10px] text-midnight-500 mb-3 italic">
            Max 12 semaines (~3 mois) par PDF. Une page A4 paysage par semaine.
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm text-xs">Annuler</button>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="btn-primary btn-sm text-xs"
            >
              Générer PDF
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
