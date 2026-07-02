-- Nouvelle entité MissionProposal : offre par consultant à envoyer au client
-- depuis une demande de mission. Rattachée à MissionRequest + Candidate + User owner.

CREATE TYPE "MissionProposalStatus" AS ENUM (
    'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'
);

CREATE TABLE "MissionProposal" (
    "id"               TEXT NOT NULL,
    "reference"        TEXT NOT NULL,
    "missionRequestId" TEXT NOT NULL,
    "candidateId"      TEXT NOT NULL,
    "ownerId"          TEXT,
    "status"           "MissionProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate"        DATE NOT NULL,
    "endDate"          DATE NOT NULL,
    "workDaysPerWeek"  DECIMAL(3,1) NOT NULL DEFAULT 5,
    "includeHolidays"  BOOLEAN NOT NULL DEFAULT true,
    "dailyRate"        DECIMAL(10,2) NOT NULL,
    "computedDays"     DECIMAL(8,2) NOT NULL DEFAULT 0,
    "computedBudgetHt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "intro"            TEXT,
    "internalNotes"    TEXT,
    "sentAt"           TIMESTAMP(3),
    "decidedAt"        TIMESTAMP(3),
    "lostReason"       TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionProposal_reference_key" ON "MissionProposal"("reference");
CREATE INDEX "MissionProposal_missionRequestId_idx" ON "MissionProposal"("missionRequestId");
CREATE INDEX "MissionProposal_candidateId_idx" ON "MissionProposal"("candidateId");
CREATE INDEX "MissionProposal_status_idx" ON "MissionProposal"("status");

ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_missionRequestId_fkey"
    FOREIGN KEY ("missionRequestId") REFERENCES "MissionRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
