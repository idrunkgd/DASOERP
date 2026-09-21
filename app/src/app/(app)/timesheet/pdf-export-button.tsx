"use client";
/**
 * Bouton "📄 PDF" avec popover date-range.
 *
 * Pré-remplit avec la semaine courante par défaut. Boutons preset :
 * cette semaine, semaine dernière, ce mois, mois dernier, personnalisé.
 * Clique final → ouvre le PDF dans un nouvel onglet (?inline=1).
 *
 * Le popover est rendu via un PORTAL dans document.body pour échapper
 * à tout stacking context parent (bannière admin, headers, etc.).
 */
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
  const [layout, setLayout] = useState<"weekly" | "monthly">("weekly");
  const [mode, setMode] = useState<"full" | "client">("full");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Recalcule la position du popover quand il s'ouvre (positionné en fixed sous le bouton)
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll, true);
    };
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

  const params = new URLSearchParams({
    from, to, layout, mode, inline: "1"
  });
  if (onBehalfOfUserId) params.set("userId", onBehalfOfUserId);
  const href = `/api/exports/timesheet-pdf?${params.toString()}`;

  const popover = open && pos && (
    <div
      ref={popRef}
      style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
      className="w-[360px] card p-3 shadow-2xl bg-white border border-border rounded-lg"
    >
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

      {/* Format PDF */}
      <div className="mb-3">
        <div className="text-[10px] text-midnight-500 uppercase tracking-wider mb-1">Format</div>
        <div className="flex gap-2">
          <label className={`flex-1 border rounded p-2 cursor-pointer text-xs ${layout === "weekly" ? "border-indigoaccent bg-indigoaccent/5" : "border-border"}`}>
            <input type="radio" name="layout" value="weekly" checked={layout === "weekly"} onChange={() => setLayout("weekly")} className="mr-1" />
            <span className="font-medium">Par semaine</span>
            <div className="text-[10px] text-midnight-500 mt-0.5">1 page A4 par semaine (7 jours)</div>
          </label>
          <label className={`flex-1 border rounded p-2 cursor-pointer text-xs ${layout === "monthly" ? "border-indigoaccent bg-indigoaccent/5" : "border-border"}`}>
            <input type="radio" name="layout" value="monthly" checked={layout === "monthly"} onChange={() => setLayout("monthly")} className="mr-1" />
            <span className="font-medium">Par mois</span>
            <div className="text-[10px] text-midnight-500 mt-0.5">1 page A4 par mois calendaire (détail 28-31 jours)</div>
          </label>
        </div>
      </div>

      {/* Mode contenu */}
      <div className="mb-3">
        <div className="text-[10px] text-midnight-500 uppercase tracking-wider mb-1">Contenu</div>
        <div className="flex gap-2">
          <label className={`flex-1 border rounded p-2 cursor-pointer text-xs ${mode === "full" ? "border-indigoaccent bg-indigoaccent/5" : "border-border"}`}>
            <input type="radio" name="mode" value="full" checked={mode === "full"} onChange={() => setMode("full")} className="mr-1" />
            <span className="font-medium">Toutes les entrées</span>
            <div className="text-[10px] text-midnight-500 mt-0.5">Avec statuts (validé, soumis, brouillon)</div>
          </label>
          <label className={`flex-1 border rounded p-2 cursor-pointer text-xs ${mode === "client" ? "border-amber-500 bg-amber-50/70" : "border-border"}`}>
            <input type="radio" name="mode" value="client" checked={mode === "client"} onChange={() => setMode("client")} className="mr-1" />
            <span className="font-medium">Vue client</span>
            <div className="text-[10px] text-midnight-500 mt-0.5">Uniquement les heures validées · pour envoi client</div>
          </label>
        </div>
      </div>

      <div className="text-[10px] text-midnight-500 mb-3 italic">
        Max 12 semaines (~3 mois) par PDF.
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
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-secondary"
        title="Exporter en PDF (date de début / date de fin)"
      >
        <FileDown className="w-3.5 h-3.5 mr-1 inline-block" /> PDF
      </button>
      {/* Portal vers document.body pour échapper à tout stacking context parent */}
      {mounted && popover && createPortal(popover, document.body)}
    </>
  );
}
