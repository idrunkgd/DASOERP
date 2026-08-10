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

/**
 * Résout le filtre statut pour un listing :
 *   - Si des statuts explicites sont cochés → filtre sur ceux-ci
 *   - Sinon si `activeOnly=true` → filtre sur les statuts encore actifs
 *   - Sinon → aucun filtre (tout afficher, défaut)
 *
 * Retourne la clause à mettre dans `where.status` (ou `undefined` si aucun
 * filtre à appliquer). Le param `active=1` dans l'URL active le filtre
 * "encore en cours".
 */
export function resolveStatusFilter<T extends string>(
  statuses: T[],
  activeOnly: boolean,
  activeStatuses: T[]
): { in: T[] } | undefined {
  if (statuses.length > 0) return { in: statuses };
  if (activeOnly) return { in: activeStatuses };
  return undefined;
}
