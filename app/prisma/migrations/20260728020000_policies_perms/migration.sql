-- Backfill des permissions policies sur les groupes existants.
-- Règle : tout groupe qui a users.manage reçoit policies.manage + read.
-- Tous les autres reçoivent policies.read (pour signer leurs propres docs).

UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'policies.manage')
WHERE NOT ('policies.manage' = ANY(permissions))
  AND ('users.manage' = ANY(permissions));

UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'policies.read')
WHERE NOT ('policies.read' = ANY(permissions));
