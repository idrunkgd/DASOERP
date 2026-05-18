"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Plus, Tags } from "lucide-react";

/**
 * Champ catégorie avec autocomplete sur les catégories existantes.
 * - Tape pour filtrer la liste
 * - Sélectionne dans la dropdown (clavier ou clic) → remplit le champ
 * - Si ta saisie n'existe pas → propose « Créer "XYZ" » (la nouvelle catégorie
 *   sera créée automatiquement quand le skill sera sauvegardé)
 *
 * Output : input hidden `name="category"` (compatible avec le server action existant).
 */
export function CategoryInput({
  name = "category",
  categories,
  initial = "",
  placeholder = "ex: Frontend, Backend, Soft skills…",
  required = false
}: {
  name?: string;
  categories: string[];
  initial?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filtre case-insensitive sur les catégories existantes
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [value, categories]);

  // Y a-t-il un match EXACT case-insensitive ?
  const exactMatch = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return null;
    return categories.find((c) => c.toLowerCase() === q) ?? null;
  }, [value, categories]);

  const canCreate = value.trim().length > 0 && !exactMatch;
  const totalChoices = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    setHighlight(0);
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  function selectCategory(cat: string) {
    setValue(cat);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, totalChoices - 1)));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (highlight < filtered.length) {
        selectCategory(filtered[highlight]);
      } else if (canCreate) {
        // "Créer XYZ" → garde simplement la saisie courante, le serveur
        // créera la catégorie automatiquement lors du save du skill
        setOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        className="input w-full"
        autoComplete="off"
      />
      {open && (filtered.length > 0 || canCreate) && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.map((cat, i) => (
            <button
              key={cat}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => selectCategory(cat)}
              className={
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 " +
                (highlight === i
                  ? "bg-indigoaccent/10 text-midnight-900"
                  : "hover:bg-midnight-50")
              }
            >
              <Tags className="w-3.5 h-3.5 text-midnight-400 shrink-0" />
              <span className="truncate">{cat}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseEnter={() => setHighlight(filtered.length)}
              onClick={() => {
                setOpen(false);
                inputRef.current?.blur();
              }}
              className={
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-t border-border " +
                (highlight === filtered.length
                  ? "bg-emerald-50 text-emerald-800"
                  : "hover:bg-emerald-50/60 text-emerald-700")
              }
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                Créer la catégorie{" "}
                <span className="font-semibold">« {value.trim()} »</span>
              </span>
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-2 text-xs text-midnight-500">
              Aucune catégorie
            </div>
          )}
        </div>
      )}
    </div>
  );
}
