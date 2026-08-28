-- Backfill des permissions training sur les groupes existants.
UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'training.manage')
WHERE NOT ('training.manage' = ANY(permissions))
  AND ('users.manage' = ANY(permissions));

UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'training.read')
WHERE NOT ('training.read' = ANY(permissions));
