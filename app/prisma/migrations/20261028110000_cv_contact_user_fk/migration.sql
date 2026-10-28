-- Ajoute un FK User.cvContactUserId → User (self-reference) pour choisir
-- un point de contact depuis la liste des users HUB plutôt que de saisir
-- 4 champs libres. Les champs legacy cvContactName/Email/Phone restent
-- pour la compat.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "cvContactUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'User_cvContactUserId_fkey' AND table_name = 'User'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_cvContactUserId_fkey"
    FOREIGN KEY ("cvContactUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ────────── Candidate : mêmes champs CV ──────────
ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "interests"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "cvContactUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "cvContactRole"   TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Candidate_cvContactUserId_fkey' AND table_name = 'Candidate'
  ) THEN
    ALTER TABLE "Candidate"
    ADD CONSTRAINT "Candidate_cvContactUserId_fkey"
    FOREIGN KEY ("cvContactUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ────────── CandidateTraining ──────────
CREATE TABLE IF NOT EXISTS "CandidateTraining" (
  "id"          TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "period"      TEXT,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CandidateTraining_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CandidateTraining_candidateId_idx" ON "CandidateTraining"("candidateId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CandidateTraining_candidateId_fkey' AND table_name = 'CandidateTraining'
  ) THEN
    ALTER TABLE "CandidateTraining"
    ADD CONSTRAINT "CandidateTraining_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
