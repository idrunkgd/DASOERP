-- Module Prospection (chasseuse de têtes) — deux tables :
--   OutreachTemplate    : bibliothèque de messages avec placeholders
--   OutreachInteraction : timeline structurée par personne contactée
--                         cible polymorphe (candidat, contact, freeform)

CREATE TYPE "OutreachDirection" AS ENUM ('OUTBOUND', 'INBOUND');
CREATE TYPE "OutreachChannel"   AS ENUM ('LINKEDIN', 'EMAIL', 'PHONE', 'MEETING', 'OTHER');
CREATE TYPE "OutreachStatus"    AS ENUM (
  'SENT', 'READ', 'REPLIED_POSITIVE', 'REPLIED_NEGATIVE', 'NO_RESPONSE', 'BOUNCED'
);
CREATE TYPE "OutreachPurpose"   AS ENUM ('SOURCE_CANDIDATE', 'SELL_TO_CLIENT', 'OTHER');

CREATE TABLE "OutreachTemplate" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "channel"      "OutreachChannel" NOT NULL,
    "purpose"      "OutreachPurpose" NOT NULL DEFAULT 'SOURCE_CANDIDATE',
    "subject"      TEXT,
    "body"         TEXT NOT NULL,
    "isArchived"   BOOLEAN NOT NULL DEFAULT false,
    "createdById"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutreachTemplate_channel_purpose_isArchived_idx"
    ON "OutreachTemplate"("channel", "purpose", "isArchived");
ALTER TABLE "OutreachTemplate" ADD CONSTRAINT "OutreachTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "OutreachInteraction" (
    "id"                  TEXT NOT NULL,
    "ownerId"             TEXT NOT NULL,
    "direction"           "OutreachDirection" NOT NULL DEFAULT 'OUTBOUND',
    "channel"             "OutreachChannel"   NOT NULL,
    "purpose"             "OutreachPurpose"   NOT NULL,
    "candidateId"         TEXT,
    "contactId"           TEXT,
    "freeformName"        TEXT,
    "freeformCompany"     TEXT,
    "freeformJobTitle"    TEXT,
    "freeformLinkedinUrl" TEXT,
    "freeformEmail"       TEXT,
    "templateId"          TEXT,
    "subject"             TEXT,
    "body"                TEXT,
    "status"              "OutreachStatus" NOT NULL DEFAULT 'SENT',
    "sentAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt"         TIMESTAMP(3),
    "responseNote"        TEXT,
    "nextActionAt"        DATE,
    "nextActionNote"      TEXT,
    "nextActionDone"      BOOLEAN NOT NULL DEFAULT false,
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutreachInteraction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutreachInteraction_ownerId_sentAt_idx"
    ON "OutreachInteraction"("ownerId", "sentAt");
CREATE INDEX "OutreachInteraction_status_idx" ON "OutreachInteraction"("status");
CREATE INDEX "OutreachInteraction_nextActionAt_nextActionDone_idx"
    ON "OutreachInteraction"("nextActionAt", "nextActionDone");
CREATE INDEX "OutreachInteraction_candidateId_idx" ON "OutreachInteraction"("candidateId");
CREATE INDEX "OutreachInteraction_contactId_idx" ON "OutreachInteraction"("contactId");
ALTER TABLE "OutreachInteraction" ADD CONSTRAINT "OutreachInteraction_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutreachInteraction" ADD CONSTRAINT "OutreachInteraction_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachInteraction" ADD CONSTRAINT "OutreachInteraction_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutreachInteraction" ADD CONSTRAINT "OutreachInteraction_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "OutreachTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
