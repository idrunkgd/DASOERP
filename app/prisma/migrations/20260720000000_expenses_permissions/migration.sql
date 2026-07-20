-- Backfill des nouvelles permissions "expenses.*" sur les groupes d'accès
-- existants pour que le module Notes de frais (promu depuis /test/expenses)
-- soit immédiatement visible pour les rôles concernés sans intervention manuelle.
--
-- Règles :
--   • Groupes ADMIN / MANAGER / FINANCE → read + write + approve
--   • Groupes COMMERCIAL / CONSULTANT     → read + write (saisir ses notes)
--   • Autres groupes → aucun accès (à activer manuellement)
--
-- L'opération est idempotente : on n'ajoute une permission que si elle n'existe
-- pas déjà dans le tableau `permissions` du groupe.

UPDATE "AccessGroup"
SET "permissions" = array(
  SELECT DISTINCT unnest("permissions" || ARRAY['expenses.read', 'expenses.write', 'expenses.approve']::text[])
)
WHERE name IN ('Administrateur', 'Manager', 'Finance');

UPDATE "AccessGroup"
SET "permissions" = array(
  SELECT DISTINCT unnest("permissions" || ARRAY['expenses.read', 'expenses.write']::text[])
)
WHERE name IN ('Commercial', 'Consultant');
