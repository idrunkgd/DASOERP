-- =============================================================
-- DOCUMENTS : DMS interne (disque local du VPS).
-- Métadonnées en DB, fichiers physiques sur /data/documents (volume Docker).
-- Versioning via parentDocumentId, liens optionnels vers entités.
-- =============================================================

CREATE TABLE IF NOT EXISTS "Document" (
  "id"               TEXT PRIMARY KEY,
  "title"            TEXT NOT NULL,
  "originalName"     TEXT NOT NULL,
  "mimeType"         TEXT NOT NULL,
  "size"             INTEGER NOT NULL,
  "storagePath"      TEXT NOT NULL,
  "description"      TEXT,
  "tags"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt"        DATE,
  "companyId"        TEXT,
  "projectId"        TEXT,
  "offerId"          TEXT,
  "consultantId"     TEXT,
  "parentDocumentId" TEXT,
  "version"          INTEGER NOT NULL DEFAULT 1,
  "uploadedById"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_consultantId_fkey"
    FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_parentDocumentId_fkey"
    FOREIGN KEY ("parentDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Document_companyId_idx"        ON "Document"("companyId");
CREATE INDEX IF NOT EXISTS "Document_projectId_idx"        ON "Document"("projectId");
CREATE INDEX IF NOT EXISTS "Document_offerId_idx"          ON "Document"("offerId");
CREATE INDEX IF NOT EXISTS "Document_consultantId_idx"     ON "Document"("consultantId");
CREATE INDEX IF NOT EXISTS "Document_parentDocumentId_idx" ON "Document"("parentDocumentId");
CREATE INDEX IF NOT EXISTS "Document_expiresAt_idx"        ON "Document"("expiresAt");
CREATE INDEX IF NOT EXISTS "Document_createdAt_idx"        ON "Document"("createdAt");
