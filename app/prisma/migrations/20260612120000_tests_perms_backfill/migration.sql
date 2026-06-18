-- =============================================================
-- Backfill : ajoute les nouvelles permissions tests.manage et
-- tests.take aux groupes d'accès existants.
--
-- Sans ce backfill, le code peut bien déclarer "tests.manage" dans
-- ROLE_PERMS.ADMIN, les perms effectives proviennent uniquement de
-- AccessGroup.permissions (cf. getUserEffectivePermissions). Du coup
-- l'entrée Sidebar « Tests techniques » n'apparaissait pas et /tests
-- renvoyait une erreur de permission.
--
-- Règle de backfill :
--   - tests.manage → tous les groupes qui ont déjà users.manage (= admin-like)
--   - tests.take   → tous les groupes non-Visiteur (perm bénigne, utile
--                    à tout consultant qui doit passer un test depuis /me)
-- =============================================================

-- 1) tests.manage sur les groupes admin (ceux qui ont users.manage)
UPDATE "AccessGroup"
SET permissions = permissions || ARRAY['tests.manage']::text[]
WHERE 'users.manage' = ANY(permissions)
  AND NOT ('tests.manage' = ANY(permissions));

-- 2) tests.take sur tous les groupes non-vides (= autre que Visiteur)
UPDATE "AccessGroup"
SET permissions = permissions || ARRAY['tests.take']::text[]
WHERE array_length(permissions, 1) > 0
  AND NOT ('tests.take' = ANY(permissions));
