-- =============================================================
-- Tests techniques : 5 questionnaires d'évaluation
-- (ELEC industrielle, PLC Siemens+Schneider, Data Manager, IT
-- industriel, Cybersécurité OT) avec tag de difficulté par question
-- pour cartographier le niveau réel (Junior → Expert).
-- =============================================================

-- Enums
CREATE TYPE "TestDomain" AS ENUM (
  'ELEC_INDUSTRIAL',
  'PLC',
  'DATA_MANAGER',
  'IT_INDUSTRIAL',
  'CYBERSEC_INDUSTRIAL'
);

CREATE TYPE "TestDifficulty" AS ENUM (
  'JUNIOR',
  'MEDIOR',
  'SENIOR',
  'EXPERT'
);

CREATE TYPE "TestAssignmentStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'EXPIRED'
);

-- Tables
CREATE TABLE "Test" (
  "id"          TEXT NOT NULL,
  "domain"      "TestDomain" NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Test_domain_key" ON "Test"("domain");

CREATE TABLE "TestQuestion" (
  "id"         TEXT NOT NULL,
  "testId"     TEXT NOT NULL,
  "position"   INTEGER NOT NULL,
  "text"       TEXT NOT NULL,
  "difficulty" "TestDifficulty" NOT NULL DEFAULT 'MEDIOR',
  "points"     INTEGER NOT NULL DEFAULT 1,
  "isScenario" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "TestQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestQuestion_testId_position_key" ON "TestQuestion"("testId", "position");
CREATE INDEX "TestQuestion_testId_idx" ON "TestQuestion"("testId");

CREATE TABLE "TestChoice" (
  "id"         TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "position"   INTEGER NOT NULL,
  "text"       TEXT NOT NULL,
  "isCorrect"  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "TestChoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestChoice_questionId_position_key" ON "TestChoice"("questionId", "position");
CREATE INDEX "TestChoice_questionId_idx" ON "TestChoice"("questionId");

CREATE TABLE "TestAssignment" (
  "id"           TEXT NOT NULL,
  "testId"       TEXT NOT NULL,
  "userId"       TEXT,
  "candidateId"  TEXT,
  "magicToken"   TEXT NOT NULL,
  "status"       "TestAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "assignedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById" TEXT NOT NULL,
  "expiresAt"    TIMESTAMP(3),
  CONSTRAINT "TestAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestAssignment_magicToken_key" ON "TestAssignment"("magicToken");
CREATE INDEX "TestAssignment_userId_idx" ON "TestAssignment"("userId");
CREATE INDEX "TestAssignment_candidateId_idx" ON "TestAssignment"("candidateId");
CREATE INDEX "TestAssignment_status_idx" ON "TestAssignment"("status");

CREATE TABLE "TestSubmission" (
  "id"           TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  "score"        INTEGER NOT NULL DEFAULT 0,
  "maxScore"     INTEGER NOT NULL DEFAULT 0,
  "scoreJunior"  INTEGER NOT NULL DEFAULT 0,
  "maxJunior"    INTEGER NOT NULL DEFAULT 0,
  "scoreMedior"  INTEGER NOT NULL DEFAULT 0,
  "maxMedior"    INTEGER NOT NULL DEFAULT 0,
  "scoreSenior"  INTEGER NOT NULL DEFAULT 0,
  "maxSenior"    INTEGER NOT NULL DEFAULT 0,
  "scoreExpert"  INTEGER NOT NULL DEFAULT 0,
  "maxExpert"    INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TestSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestSubmission_assignmentId_key" ON "TestSubmission"("assignmentId");

CREATE TABLE "TestAnswer" (
  "id"           TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "questionId"   TEXT NOT NULL,
  "choiceId"     TEXT NOT NULL,
  "answeredAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestAnswer_submissionId_questionId_key" ON "TestAnswer"("submissionId", "questionId");
CREATE INDEX "TestAnswer_submissionId_idx" ON "TestAnswer"("submissionId");

-- Foreign keys
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestChoice" ADD CONSTRAINT "TestChoice_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "TestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAssignment" ADD CONSTRAINT "TestAssignment_testId_fkey"
  FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAssignment" ADD CONSTRAINT "TestAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAssignment" ADD CONSTRAINT "TestAssignment_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAssignment" ADD CONSTRAINT "TestAssignment_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON UPDATE CASCADE;
ALTER TABLE "TestSubmission" ADD CONSTRAINT "TestSubmission_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "TestAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_submissionId_fkey"
  FOREIGN KEY ("submissionId") REFERENCES "TestSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "TestQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestAnswer" ADD CONSTRAINT "TestAnswer_choiceId_fkey"
  FOREIGN KEY ("choiceId") REFERENCES "TestChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
