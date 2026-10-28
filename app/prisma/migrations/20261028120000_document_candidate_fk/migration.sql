-- Lien Document ↔ Candidate pour les fichiers rattachés à une fiche candidat
-- (CV externes, rapports d'entretien, lettres de motivation, etc.)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "candidateId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Document"
    ADD CONSTRAINT "Document_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Document_candidateId_idx" ON "Document"("candidateId");
