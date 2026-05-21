-- =============================================================
-- TEST FEATURES — Notes de frais + CRM pipeline
-- =============================================================
-- Idempotent : IF NOT EXISTS partout pour les enums et tables.

-- Enums Notes de frais
DO $$ BEGIN
  CREATE TYPE "ExpenseReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PAID');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseReportCategory" AS ENUM (
    'TRANSPORT', 'MEAL', 'ACCOMMODATION', 'SUPPLIES', 'SOFTWARE', 'TRAINING', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum CRM
DO $$ BEGIN
  CREATE TYPE "OpportunityStage" AS ENUM ('NEW', 'QUALIFIED', 'PROPOSED', 'NEGOTIATING', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table ExpenseReport
CREATE TABLE IF NOT EXISTS "ExpenseReport" (
  "id"              TEXT PRIMARY KEY,
  "userId"          TEXT NOT NULL,
  "missionId"       TEXT,
  "projectId"       TEXT,
  "date"            DATE NOT NULL,
  "category"        "ExpenseReportCategory" NOT NULL DEFAULT 'OTHER',
  "description"     TEXT NOT NULL,
  "amountHt"        DECIMAL(10,2) NOT NULL,
  "vatAmount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
  "vatRate"         DECIMAL(5,2) NOT NULL DEFAULT 21,
  "amountTtc"       DECIMAL(10,2) NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'EUR',
  "receiptUrl"      TEXT,
  "ocrPayload"      JSONB,
  "status"          "ExpenseReportStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt"     TIMESTAMP(3),
  "approvedById"    TEXT,
  "approvedAt"      TIMESTAMP(3),
  "rejectionReason" TEXT,
  "paidAt"          TIMESTAMP(3),
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ExpenseReport" ADD CONSTRAINT "ExpenseReport_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "ExpenseReport_userId_date_idx"    ON "ExpenseReport"("userId", "date");
CREATE INDEX IF NOT EXISTS "ExpenseReport_status_idx"         ON "ExpenseReport"("status");
CREATE INDEX IF NOT EXISTS "ExpenseReport_missionId_idx"      ON "ExpenseReport"("missionId");
CREATE INDEX IF NOT EXISTS "ExpenseReport_projectId_idx"      ON "ExpenseReport"("projectId");

-- Table Opportunity
CREATE TABLE IF NOT EXISTS "Opportunity" (
  "id"              TEXT PRIMARY KEY,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "companyId"       TEXT,
  "prospectName"    TEXT,
  "prospectEmail"   TEXT,
  "prospectPhone"   TEXT,
  "ownerId"         TEXT,
  "stage"           "OpportunityStage" NOT NULL DEFAULT 'NEW',
  "estimatedValue"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "probability"     INTEGER NOT NULL DEFAULT 20,
  "expectedCloseAt" DATE,
  "closedAt"        TIMESTAMP(3),
  "lostReason"      TEXT,
  "notes"           TEXT,
  "source"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Opportunity_stage_idx"           ON "Opportunity"("stage");
CREATE INDEX IF NOT EXISTS "Opportunity_ownerId_idx"         ON "Opportunity"("ownerId");
CREATE INDEX IF NOT EXISTS "Opportunity_expectedCloseAt_idx" ON "Opportunity"("expectedCloseAt");

-- Table OpportunityActivity
CREATE TABLE IF NOT EXISTS "OpportunityActivity" (
  "id"            TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "userId"        TEXT,
  "kind"          TEXT NOT NULL,
  "subject"       TEXT NOT NULL,
  "body"          TEXT,
  "occurredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OpportunityActivity" ADD CONSTRAINT "OpportunityActivity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OpportunityActivity_opportunityId_occurredAt_idx"
  ON "OpportunityActivity"("opportunityId", "occurredAt");
