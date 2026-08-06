"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

/**
 * Filtre multi-sélection sous forme de dropdown compact avec cases à cocher.
 * Utilisé pour les listes longues (clients, utilisateurs, projets…) là où
 * les FilterChips prendraient trop de place à l'écran.
 *
 * URL sync identique à FilterChips : valeurs stockées en CSV dans le query
 * param `paramName`. Compatible avec le même `parseMulti` côté serveur.
 *
 * UX :
 *   - Bouton "Label" ou "Label (N)" quand N valeurs sélectionnées
 *   - Clic → popover avec search + liste scrollable de checkboxes
 *   - Un petit × sur le bouton pour tout effacer si N > 0
 */
export type FilterMultiSelectOption = {
  value: string;
  label: string;
};

export function FilterMultiSelect({
  paramName,
  label,
  options,
  placeholder = "Rechercher…"
}: {
  paramName: string;
  label: string;
  options: FilterMultiSelectOption[];
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const current = useMemo(() => {
    const raw = searchParams.get(paramName) ?? "";
    return new Set(raw.split(",").map((v) => v.trim()).filter(Boolean));
  }, [searchParams, paramName]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    const t = setTimeout(() => window.addEventListener("click", onClick), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("click", onClick);
    };
  }, [open]);

  const updateParam = useCallback(
    (next: Set<string>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.has("page")) params.set("page", "1");
      if (next.size === 0) params.delete(paramName);
      else params.set(paramName, Array.from(next).join(","));
      start(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [paramName, pathname, router, searchParams]
  );

  const toggle = useCallback(
    (value: string) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      updateParam(next);
    },
    [current, updateParam]
  );

  const clear = useCallback(() => {
    updateParam(new Set());
    setQuery("");
  }, [updateParam]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const count = current.size;
  const btnLabel = count > 0 ? `${label} · ${count}` : label;

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs transition-colors " +
          (count > 0
            ? "bg-indigoaccent text-white border-indigoaccent shadow-sm"
            : "bg-white border-border text-midnight-700 hover:border-indigoaccent hover:text-indigoaccent")
        }
      >
        <span>{btnLabel}</span>
        {count > 0 ? (
          <span
            onClick={(e) => { e.stopPropagation(); clear(); }}
            role="button"
            aria-label="Effacer"
            className="hover:bg-white/20 rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </span>
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-8 w-72 bg-white border border-border rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-midnight-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                autoFocus
                className="input text-xs pl-7 py-1.5"
              />
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-midnight-400 italic px-3 py-2">
                Aucun résultat
              </p>
            ) : (
              filtered.map((opt) => {
                const active = current.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-midnight-50 " +
                      (active ? "text-indigoaccent font-medium" : "text-midnight-700")
                    }
                  >
                    <span
                      className={
                        "w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 " +
                        (active ? "bg-indigoaccent border-indigoaccent" : "border-midnight-300")
                      }
                    >
                      {active && <Check className="w-2.5 h-2.5 text-white" />}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {count > 0 && (
            <div className="border-t border-border px-2 py-1.5 text-right">
              <button
                type="button"
                onClick={clear}
                className="text-[10px] text-midnight-500 hover:text-red-600"
              >
                Effacer ({count})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
