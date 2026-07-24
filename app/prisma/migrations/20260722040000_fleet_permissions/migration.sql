-- Backfill perms flotte sur les groupes existants
-- Tous les groupes qui avaient "leaves.read" reçoivent aussi "fleet.read"
UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'fleet.read')
WHERE 'leaves.read' = ANY(permissions)
  AND NOT ('fleet.read' = ANY(permissions));

-- Groupes qui gèrent les congés (leaves.approve) sont probablement RH → fleet.manage aussi
UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'fleet.manage')
WHERE 'leaves.approve' = ANY(permissions)
  AND NOT ('fleet.manage' = ANY(permissions));
