-- Portail client : lien unique immuable par équipe/client avec propositions candidats
CREATE TABLE IF NOT EXISTS "ClientPortal" (
  "id"           TEXT PRIMARY KEY,
  "token"        TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "companyId"    TEXT NOT NULL,
  "logoUrl"      TEXT,
  "contactName"  TEXT,
  "contactEmail" TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "notes"        TEXT,
  "createdById"  TEXT,
  "lastViewedAt" TIMESTAMP(3),
  "viewCount"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientPortal_token_key" ON "ClientPortal"("token");
CREATE INDEX IF NOT EXISTS "ClientPortal_companyId_idx" ON "ClientPortal"("companyId");
CREATE INDEX IF NOT EXISTS "ClientPortal_isActive_idx" ON "ClientPortal"("isActive");

DO $$ BEGIN
  ALTER TABLE "ClientPortal"
    ADD CONSTRAINT "ClientPortal_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClientPortal"
    ADD CONSTRAINT "ClientPortal_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table CandidateProposal (proposition d'un candidat à un portail)
CREATE TABLE IF NOT EXISTS "CandidateProposal" (
  "id"                TEXT PRIMARY KEY,
  "portalId"          TEXT NOT NULL,
  "candidateId"       TEXT NOT NULL,
  "missionRequestId"  TEXT,
  "proposedDailyRate" DECIMAL(10, 2) NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'PROPOSED',
  "clientMessage"     TEXT,
  "clientActedAt"     TIMESTAMP(3),
  "internalNote"      TEXT,
  "isVisible"         BOOLEAN NOT NULL DEFAULT true,
  "ownerUserId"       TEXT,
  "createdById"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CandidateProposal_portalId_isVisible_idx" ON "CandidateProposal"("portalId", "isVisible");
CREATE INDEX IF NOT EXISTS "CandidateProposal_candidateId_idx" ON "CandidateProposal"("candidateId");
CREATE INDEX IF NOT EXISTS "CandidateProposal_status_idx" ON "CandidateProposal"("status");

DO $$ BEGIN
  ALTER TABLE "CandidateProposal"
    ADD CONSTRAINT "CandidateProposal_portalId_fkey"
    FOREIGN KEY ("portalId") REFERENCES "ClientPortal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateProposal"
    ADD CONSTRAINT "CandidateProposal_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateProposal"
    ADD CONSTRAINT "CandidateProposal_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
