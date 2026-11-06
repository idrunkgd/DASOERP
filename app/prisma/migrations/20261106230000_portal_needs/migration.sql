-- Besoins/postes d'un portail client (ex: "Senior Automation", "Roboticien").
-- Permet de regrouper les candidats proposés par poste côté client.
CREATE TABLE IF NOT EXISTS "ClientPortalNeed" (
  "id"          TEXT PRIMARY KEY,
  "portalId"    TEXT NOT NULL REFERENCES "ClientPortal"("id") ON DELETE CASCADE,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "status"      TEXT NOT NULL DEFAULT 'OPEN',
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ClientPortalNeed_portalId_sortOrder_idx"
  ON "ClientPortalNeed" ("portalId", "sortOrder");

-- Rattachement optionnel d'une proposition à un besoin
ALTER TABLE "CandidateProposal"
  ADD COLUMN IF NOT EXISTS "needId" TEXT
  REFERENCES "ClientPortalNeed"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "CandidateProposal_needId_idx"
  ON "CandidateProposal" ("needId");
