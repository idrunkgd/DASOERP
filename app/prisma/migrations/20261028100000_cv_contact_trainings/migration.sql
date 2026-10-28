-- Ajoute : point de contact affiché sur le CV à la place du consultant,
--          centres d'intérêt (interests), modèle UserTraining pour les
--          formations/diplômes/certifications.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "cvContactName"  TEXT,
  ADD COLUMN IF NOT EXISTS "cvContactRole"  TEXT,
  ADD COLUMN IF NOT EXISTS "cvContactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "cvContactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "interests"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE IF NOT EXISTS "UserTraining" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "institution" TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "period"      TEXT,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserTraining_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserTraining_userId_idx" ON "UserTraining"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'UserTraining_userId_fkey' AND table_name = 'UserTraining'
  ) THEN
    ALTER TABLE "UserTraining"
    ADD CONSTRAINT "UserTraining_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
