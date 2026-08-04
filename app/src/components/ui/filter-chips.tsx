"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import { X } from "lucide-react";

/**
 * Filtre multi-sélection sous forme de pills toggleables, synchronisé
 * avec un query param dans l'URL. Une valeur = un pill. Cliquer active
 * ou désactive. Plusieurs valeurs séparées par une virgule dans l'URL.
 *
 * Exemple : /contacts?status=ACTIVE,PROSPECT → chips ACTIVE + PROSPECT
 * en surbrillance.
 *
 * Un debounce léger via useTransition évite les mises à jour visuelles
 * saccadées quand l'utilisateur clique vite.
 */
export type FilterOption = {
  value: string;
  label: string;
  count?: number;
  /** Petit indicateur coloré optionnel (statut vert/orange/rouge…) */
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
};

const TONE_ACCENT: Record<NonNullable<FilterOption["tone"]>, string> = {
  success: "before:bg-emerald-500",
  warning: "before:bg-amber-500",
  danger:  "before:bg-red-500",
  info:    "before:bg-indigoaccent",
  neutral: "before:bg-midnight-400"
};

export function FilterChips({
  paramName,
  label,
  options,
  multi = true,
  className = ""
}: {
  /** Nom du query param dans l'URL (ex: "status", "kind", "user") */
  paramName: string;
  /** Titre du groupe affiché à gauche des chips (facultatif) */
  label?: string;
  options: FilterOption[];
  /** Si false, se comporte comme un radio (une seule valeur) */
  multi?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, start] = useTransition();

  const current = useMemo(() => {
    const raw = searchParams.get(paramName) ?? "";
    return new Set(raw.split(",").map((v) => v.trim()).filter(Boolean));
  }, [searchParams, paramName]);

  const toggle = useCallback(
    (value: string) => {
      const next = new Set(current);
      if (multi) {
        if (next.has(value)) next.delete(value);
        else next.add(value);
      } else {
        // Radio : clic sur actif = désactive, sinon remplace.
        if (next.has(value) && next.size === 1) next.clear();
        else {
          next.clear();
          next.add(value);
        }
      }
      const params = new URLSearchParams(searchParams.toString());
      // On repart à la page 1 si un param `page` est présent — le filtre
      // change généralement le nombre de résultats.
      if (params.has("page")) params.set("page", "1");
      if (next.size === 0) params.delete(paramName);
      else params.set(paramName, Array.from(next).join(","));
      start(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [current, multi, paramName, pathname, router, searchParams]
  );

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(paramName);
    if (params.has("page")) params.set("page", "1");
    start(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }, [paramName, pathname, router, searchParams]);

  const hasSelection = current.size > 0;

  return (
    <div className={"flex items-center gap-1.5 flex-wrap " + className}>
      {label && (
        <span className="text-[11px] font-medium text-midnight-500 uppercase tracking-wide mr-1">
          {label}
        </span>
      )}
      {options.map((opt) => {
        const active = current.has(opt.value);
        const toneClass = opt.tone
          ? `before:content-[''] before:inline-block before:w-1.5 before:h-1.5 before:rounded-full before:mr-1.5 ${TONE_ACCENT[opt.tone]}`
          : "";
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={
              "inline-flex items-center px-2.5 py-1 rounded-full border text-xs transition-colors " +
              toneClass +
              " " +
              (active
                ? "bg-indigoaccent text-white border-indigoaccent shadow-sm"
                : "bg-white border-border text-midnight-700 hover:border-indigoaccent hover:text-indigoaccent")
            }
          >
            <span>{opt.label}</span>
            {opt.count != null && (
              <span
                className={
                  "ml-1.5 text-[10px] px-1 rounded " +
                  (active ? "bg-white/25" : "bg-midnight-100 text-midnight-500")
                }
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
      {hasSelection && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-midnight-500 hover:text-red-600"
          title="Effacer ce filtre"
        >
          <X className="w-3 h-3" /> Effacer
        </button>
      )}
    </div>
  );
}
