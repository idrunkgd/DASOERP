-- Add jobTitle to Candidate (titre affiché sur le portail client à la place
-- de la dernière expérience CV).
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
