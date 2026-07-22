-- Module de gestion des congés : quota annuel sur User + workflow demandes
-- (SUBMITTED → APPROVED/REJECTED), avec case "accord client" pour les
-- consultants en mission.

CREATE TYPE "LeaveRequestStatus" AS ENUM (
  'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'
);
CREATE TYPE "LeaveType" AS ENUM (
  'ANNUAL', 'RTT', 'UNPAID', 'SPECIAL', 'OTHER'
);

-- Quota annuel de jours de congé (défaut 20 pour la Belgique).
ALTER TABLE "User" ADD COLUMN "annualLeaveDays" INTEGER NOT NULL DEFAULT 20;

CREATE TABLE "LeaveRequest" (
  "id"                  TEXT NOT NULL,
  "userId"              TEXT NOT NULL,
  "startDate"           DATE NOT NULL,
  "endDate"             DATE NOT NULL,
  "days"                DECIMAL(4, 1) NOT NULL,
  "type"                "LeaveType" NOT NULL DEFAULT 'ANNUAL',
  "reason"              TEXT,
  "notes"               TEXT,
  "status"              "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt"         TIMESTAMP(3),
  "approvedById"        TEXT,
  "approvedAt"          TIMESTAMP(3),
  "rejectionReason"     TEXT,
  "missionId"           TEXT,
  "clientApproved"      BOOLEAN NOT NULL DEFAULT false,
  "clientApprovalNotes" TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeaveRequest_userId_startDate_idx"    ON "LeaveRequest"("userId", "startDate");
CREATE INDEX "LeaveRequest_status_idx"              ON "LeaveRequest"("status");
CREATE INDEX "LeaveRequest_startDate_endDate_idx"   ON "LeaveRequest"("startDate", "endDate");

ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeaveRequest"
  ADD CONSTRAINT "LeaveRequest_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
