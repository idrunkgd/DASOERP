"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus, X, Sparkles, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { findOrCreateSkill } from "@/server/actions/skills";

type Skill = { id: string; name: string; category: string | null };

/**
 * Sélecteur de compétences avec autocomplete et création à la volée :
 *  - Tape pour filtrer le catalogue
 *  - Sélectionne dans la dropdown ou tape Enter
 *  - Si ta saisie ne matche aucune entrée → propose « Créer "XYZ" »
 *  - Respecte la casse de ce que tu écris (vs la casse de l'existant)
 *
 * Output : input hidden `name` avec valeur CSV (compatible Zod existant String[]).
 */
export function SkillsPicker({
  name = "skills",
  catalog,
  initial = [],
  label = "Compétences"
}: {
  name?: string;
  catalog: Skill[];
  initial?: string[];
  label?: string;
}) {
  // On garde la casse stockée dans la fiche, mais on dédoublonne en
  // case-insensitive pour éviter "React" et "react" en doublon.
  const [selected, setSelected] = useState<string[]>(() =>
    uniqueByLower(initial)
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [pending, startTransition] = useTransition();
  const [localCatalog, setLocalCatalog] = useState<Skill[]>(catalog);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map des compétences sélectionnées indexées par lowercase pour test rapide
  const selectedLowerSet = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected]
  );

  // Filtre le catalogue local par la query (case-insensitive)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Si pas de query, montre quelques suggestions (catalogue trié)
      return localCatalog
        .filter((s) => !selectedLowerSet.has(s.name.toLowerCase()))
        .slice(0, 12);
    }
    return localCatalog
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) &&
          !selectedLowerSet.has(s.name.toLowerCase())
      )
      .slice(0, 20);
  }, [query, localCatalog, selectedLowerSet]);

  // Y a-t-il un match EXACT en case-insensitive ?
  const exactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return localCatalog.find((s) => s.name.toLowerCase() === q);
  }, [query, localCatalog]);

  const canCreate = query.trim().length > 0 && !exactMatch;
  // Items à afficher : filtered + éventuelle option "Créer"
  const items = filtered;
  const totalChoices = items.length + (canCreate ? 1 : 0);

  // Reset highlight quand la query change
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Fermer la dropdown sur clic en dehors
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  function addExisting(skillName: string) {
    if (selectedLowerSet.has(skillName.toLowerCase())) return;
    setSelected((prev) => [...prev, skillName]);
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function createAndAdd(rawName: string) {
    const trimmed = rawName.trim();
    if (!trimmed) return;
    if (selectedLowerSet.has(trimmed.toLowerCase())) {
      toast.info("Déjà sélectionnée");
      return;
    }
    startTransition(async () => {
      try {
        const result = await findOrCreateSkill({ name: trimmed });
        // Ajoute à la liste locale du catalogue si vraiment créée
        if (result.created) {
          setLocalCatalog((prev) => [
            ...prev,
            { id: `tmp-${Date.now()}`, name: result.name, category: null }
          ]);
          toast.success(`« ${result.name} » créée dans le catalogue`);
        }
        // Utilise la casse retournée (existante si déjà en base, sinon la nôtre)
        setSelected((prev) => [...prev, result.name]);
        setQuery("");
        inputRef.current?.focus();
      } catch (e: any) {
        toast.error(e?.message ?? "Erreur lors de la création");
      }
    });
  }

  function remove(skillName: string) {
    setSelected((prev) =>
      prev.filter((s) => s.toLowerCase() !== skillName.toLowerCase())
    );
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, totalChoices - 1)));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (totalChoices === 0) return;
      // Si highlight pointe sur le bouton "Créer"
      if (highlight === items.length && canCreate) {
        createAndAdd(query);
        return;
      }
      const chosen = items[highlight];
      if (chosen) addExisting(chosen.name);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      // Backspace dans un champ vide → retire la dernière chip
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div ref={containerRef}>
      <input
        type="hidden"
        name={name}
        value={selected.join(", ")}
      />
      <label className="label">
        {label}{" "}
        <span className="text-midnight-400">
          ({selected.length} sélectionnée{selected.length > 1 ? "s" : ""})
        </span>
      </label>

      {/* Boîte avec chips + input */}
      <div
        className="border border-border rounded-lg p-2 bg-white min-h-[42px] cursor-text flex flex-wrap gap-1.5 items-center focus-within:ring-2 focus-within:ring-indigoaccent/30 focus-within:border-indigoaccent/50"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((s) => (
          <Chip key={s} label={s} onRemove={() => remove(s)} />
        ))}
        <div className="relative flex-1 min-w-[160px]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={
              selected.length === 0
                ? "Tape pour rechercher ou créer une compétence…"
                : "Ajouter…"
            }
            className="w-full bg-transparent text-sm focus:outline-none px-1 py-1"
            disabled={pending}
          />
          {pending && (
            <Loader2 className="w-3.5 h-3.5 absolute right-1 top-1/2 -translate-y-1/2 animate-spin text-midnight-400" />
          )}
        </div>
      </div>

      {/* Dropdown des suggestions */}
      {open && (items.length > 0 || canCreate) && (
        <div className="relative">
          <div className="absolute mt-1 w-full bg-white border border-border rounded-lg shadow-lg z-30 max-h-80 overflow-y-auto">
            {items.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => addExisting(s.name)}
                className={
                  "w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 " +
                  (highlight === i
                    ? "bg-indigoaccent/10 text-midnight-900"
                    : "hover:bg-midnight-50")
                }
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-3.5 h-3.5 text-midnight-400 shrink-0" />
                  <span className="truncate">{s.name}</span>
                </span>
                {s.category && (
                  <span className="text-[10px] text-midnight-400 shrink-0">
                    {s.category}
                  </span>
                )}
              </button>
            ))}
            {canCreate && (
              <button
                type="button"
                onMouseEnter={() => setHighlight(items.length)}
                onClick={() => createAndAdd(query)}
                disabled={pending}
                className={
                  "w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-t border-border " +
                  (highlight === items.length
                    ? "bg-emerald-50 text-emerald-800"
                    : "hover:bg-emerald-50/60 text-emerald-700")
                }
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  Créer la compétence{" "}
                  <span className="font-semibold">« {query.trim()} »</span>
                </span>
              </button>
            )}
            {items.length === 0 && !canCreate && (
              <div className="px-3 py-2 text-xs text-midnight-500">
                Aucun résultat
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-midnight-400 mt-1">
        ↑↓ pour naviguer, Entrée pour sélectionner/créer, Backspace pour
        retirer la dernière. La casse de ce que tu tapes est préservée
        quand tu crées une nouvelle compétence.
      </p>
    </div>
  );
}

function Chip({
  label,
  onRemove
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigoaccent/15 text-indigoaccent text-xs border border-indigoaccent/30">
      <Check className="w-3 h-3" />
      {label}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="hover:text-red-700 text-indigoaccent/70 ml-0.5"
        aria-label={`Retirer ${label}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/** Dédoublonne en case-insensitive en conservant la première casse rencontrée. */
function uniqueByLower(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}
