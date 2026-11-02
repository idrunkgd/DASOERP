-- Liens personnels par contact sur un portail client + attribution des actions

CREATE TABLE IF NOT EXISTS "ClientPortalContact" (
  "id"            TEXT PRIMARY KEY,
  "token"         TEXT NOT NULL,
  "portalId"      TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "email"         TEXT,
  "jobTitle"      TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "lastViewedAt"  TIMESTAMP(3),
  "viewCount"     INTEGER NOT NULL DEFAULT 0,
  "createdById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortalContact_token_key" ON "ClientPortalContact"("token");
CREATE INDEX IF NOT EXISTS "ClientPortalContact_portalId_isActive_idx" ON "ClientPortalContact"("portalId", "isActive");

DO $$ BEGIN
  ALTER TABLE "ClientPortalContact"
    ADD CONSTRAINT "ClientPortalContact_portalId_fkey"
    FOREIGN KEY ("portalId") REFERENCES "ClientPortal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientPortalContact"
    ADD CONSTRAINT "ClientPortalContact_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Attribution d'une action client à un contact nominatif (null si lien général)
ALTER TABLE "CandidateProposal"
  ADD COLUMN IF NOT EXISTS "actedByContactId"   TEXT,
  ADD COLUMN IF NOT EXISTS "actedByContactName" TEXT;
