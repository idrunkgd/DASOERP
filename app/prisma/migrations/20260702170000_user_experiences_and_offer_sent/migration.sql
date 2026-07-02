-- Deux changements liés à la refonte MissionProposal :
--   1. UserExperience : miroir de CandidateExperience pour les consultants
--      internes. Le PDF de proposition consultant a besoin des mêmes champs
--      (poste, société, dates, description) qu'il s'agisse d'un candidat
--      externe ou d'un User interne.
--   2. ApplicationStatus.OFFER_SENT : nouveau statut entre PRESENTED et
--      SELECTED, mis automatiquement quand on génère la proposition PDF.

-- ─── 1. UserExperience ───
CREATE TABLE "UserExperience" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle"    TEXT,
    "startDate"   DATE NOT NULL,
    "endDate"     DATE,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExperience_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserExperience_userId_startDate_idx" ON "UserExperience"("userId", "startDate");

ALTER TABLE "UserExperience" ADD CONSTRAINT "UserExperience_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 2. ApplicationStatus.OFFER_SENT ───
-- Ajouté hors transaction Prisma (ADD VALUE ne supporte pas la commit
-- retardée dans certains contextes). IF NOT EXISTS pour la ré-application.
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER_SENT' AFTER 'SHORTLISTED';
