-- Backfill des permissions contracts sur les AccessGroup existants.
-- Règle : tout groupe qui a users.manage ou consulting.write reçoit
-- contracts.manage + contracts.read. Les autres reçoivent au moins
-- contracts.read s'ils ont documents.read (contexte RH).

UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'contracts.manage')
WHERE NOT ('contracts.manage' = ANY(permissions))
  AND ('users.manage' = ANY(permissions) OR 'consulting.write' = ANY(permissions));

UPDATE "AccessGroup"
SET permissions = array_append(permissions, 'contracts.read')
WHERE NOT ('contracts.read' = ANY(permissions))
  AND ('contracts.manage' = ANY(permissions) OR 'documents.read' = ANY(permissions));
