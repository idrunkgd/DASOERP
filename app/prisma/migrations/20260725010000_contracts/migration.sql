-- ─── Champs personnels ajoutés à User + Candidate pour la génération de contrats
ALTER TABLE "User"
  ADD COLUMN "birthDate"      DATE,
  ADD COLUMN "birthPlace"     TEXT,
  ADD COLUMN "nationalNumber" TEXT,
  ADD COLUMN "address"        TEXT,
  ADD COLUMN "postalCode"     TEXT,
  ADD COLUMN "country"        TEXT DEFAULT 'Belgique';

ALTER TABLE "Candidate"
  ADD COLUMN "birthDate"      DATE,
  ADD COLUMN "birthPlace"     TEXT,
  ADD COLUMN "nationalNumber" TEXT,
  ADD COLUMN "address"        TEXT,
  ADD COLUMN "postalCode"     TEXT,
  ADD COLUMN "country"        TEXT DEFAULT 'Belgique';

-- ─── Module contrats

CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'TERMINATED', 'CANCELLED');

CREATE TABLE "ContractTemplate" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "ContractTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX "ContractTemplate_active_idx" ON "ContractTemplate"("active");

CREATE TABLE "ContractTemplateChapter" (
  "id"         TEXT PRIMARY KEY,
  "templateId" TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "bodyMd"     TEXT NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractTemplateChapter_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE CASCADE
);
CREATE INDEX "ContractTemplateChapter_templateId_sortOrder_idx"
  ON "ContractTemplateChapter"("templateId", "sortOrder");

CREATE TABLE "Contract" (
  "id"             TEXT PRIMARY KEY,
  "reference"      TEXT NOT NULL UNIQUE,
  "title"          TEXT NOT NULL,
  "status"         "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "templateId"     TEXT,
  "templateName"   TEXT,
  "userId"         TEXT,
  "candidateId"    TEXT,
  "chapters"       JSONB NOT NULL,
  "startDate"      DATE,
  "endDate"        DATE,
  "signedAt"       TIMESTAMP(3),
  "terminatedAt"   TIMESTAMP(3),
  "notes"          TEXT,
  "generatedById"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ContractTemplate"("id") ON DELETE SET NULL,
  CONSTRAINT "Contract_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Contract_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE,
  CONSTRAINT "Contract_generatedById_fkey"
    FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX "Contract_userId_status_idx" ON "Contract"("userId", "status");
CREATE INDEX "Contract_candidateId_status_idx" ON "Contract"("candidateId", "status");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");
