/**
 * Helpers pour parser les query params multi-valeurs utilisés par
 * <FilterChips> (format CSV) côté serveur.
 *
 * Exemple d'URL : /commercial?kind=todo,call&user=abc,def
 */

/** Parse un param CSV en Array<string> (vide → array vide). */
export function parseMulti(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap(parseMulti);
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Construit un `WHERE ... IN (...)` Prisma, ou `undefined` si vide. */
export function inFilter<T extends string>(values: T[]): { in: T[] } | undefined {
  return values.length > 0 ? { in: values } : undefined;
}
