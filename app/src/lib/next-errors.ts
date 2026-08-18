/**
 * Helpers pour distinguer les vraies erreurs des exceptions de contrôle
 * de flux utilisées par Next.js (redirect, notFound).
 *
 * ⚠️ IMPORTANT — pattern à respecter dans les composants client :
 *
 *   try {
 *     await maServerAction(fd);
 *   } catch (e) {
 *     if (isNextControlFlow(e)) throw e; // ← LAISSE PASSER
 *     toast.error(e.message);
 *   }
 *
 * Sans le re-throw, l'appel de `redirect()` ou `notFound()` fait depuis la
 * server action est avalé silencieusement → l'utilisateur reste bloqué sur
 * la page en pensant que l'action a échoué, alors qu'elle a réussi (et souvent
 * modifié la DB !). C'était la cause du bug "recruter en consultant" qui
 * levait 'Un utilisateur existe déjà' au 2e clic.
 */

export function isNextRedirect(e: any): boolean {
  return typeof e?.digest === "string" && e.digest.startsWith("NEXT_REDIRECT");
}

export function isNextNotFound(e: any): boolean {
  return typeof e?.digest === "string" && e.digest === "NEXT_NOT_FOUND";
}

/** True pour toute exception de contrôle de flux Next.js à laisser remonter. */
export function isNextControlFlow(e: any): boolean {
  return isNextRedirect(e) || isNextNotFound(e);
}
