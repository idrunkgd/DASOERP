-- =============================================================
-- BACKFILL DES NOUVELLES PERMISSIONS sur les groupes existants
-- Avant : plusieurs entrées de menu (CRM, Documents, Onboarding, Outils & apps,
-- Tableau de bord, Statut projet, TVA, Audit, Entretiens, Matching) étaient
-- ouvertes à tout user connecté via `allowedRoles` côté sidebar (sans aucune
-- permission requise). Maintenant elles passent par des permissions dédiées
-- (dashboard.read, applinks.read, crm.read, ... etc.).
-- Pour ne pas casser l'expérience existante, on ajoute ces nouvelles
-- permissions à tous les groupes d'accès qui en ont déjà au moins une
-- (donc les groupes "non-Visiteur"). Les groupes "Visiteur" restent vides.
-- =============================================================

-- Liste exhaustive des nouvelles permissions
WITH new_perms AS (
  SELECT unnest(ARRAY[
    'dashboard.read',
    'applinks.read',
    'applinks.write',
    'crm.read',
    'crm.write',
    'reviews.read',
    'reviews.write',
    'onboarding.read',
    'onboarding.write',
    'documents.read',
    'documents.write',
    'audit.read'
  ]) AS perm
)
UPDATE "AccessGroup"
SET "permissions" = ARRAY(
  SELECT DISTINCT unnest("permissions" || (SELECT array_agg(perm) FROM new_perms))
)
WHERE cardinality("permissions") > 0;
-- Note : on n'ajoute pas aux groupes vides (Visiteur), on respecte leur intention.
