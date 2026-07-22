-- Backfill des permissions leaves.* sur les groupes existants.
-- Admin/Manager/Finance : peuvent voir + approuver.
-- Commercial/Consultant : peuvent voir + créer leurs propres demandes.

UPDATE "AccessGroup"
SET "permissions" = array(
  SELECT DISTINCT unnest("permissions" || ARRAY['leaves.read', 'leaves.write', 'leaves.approve']::text[])
)
WHERE name IN ('Administrateur', 'Manager', 'Finance');

UPDATE "AccessGroup"
SET "permissions" = array(
  SELECT DISTINCT unnest("permissions" || ARRAY['leaves.read', 'leaves.write']::text[])
)
WHERE name IN ('Commercial', 'Consultant');
