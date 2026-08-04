import type { ReactNode } from "react";

/**
 * Formulaire GET qui préserve automatiquement tous les query params existants
 * (sauf ceux listés dans `except`, typiquement les champs éditables par le
 * form comme "q", "from", "to", "page"). Ces params seront rendus en
 * <input hidden> pour repartir sur la même URL enrichie de la nouvelle
 * recherche.
 *
 * Nécessaire quand on mélange :
 *   - Des filtres client (FilterChips → écrivent directement l'URL)
 *   - Un form de recherche (q + dates) qui submit avec method GET
 *
 * Sans les hidden inputs, la soumission du form efface les filtres actifs.
 */
export function PreservedSearchForm({
  searchParams,
  except,
  className,
  children
}: {
  searchParams: Record<string, string | string[] | undefined>;
  except: string[];
  className?: string;
  children: ReactNode;
}) {
  const excludeSet = new Set(except);
  const preserved: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(searchParams)) {
    if (excludeSet.has(key)) continue;
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) preserved.push([key, v]);
    } else {
      preserved.push([key, value]);
    }
  }
  return (
    <form className={className}>
      {preserved.map(([k, v], i) => (
        <input key={`${k}-${i}`} type="hidden" name={k} value={v} />
      ))}
      {children}
    </form>
  );
}
