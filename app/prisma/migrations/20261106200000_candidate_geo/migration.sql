-- Ajoute code postal + coordonnées géographiques au candidat (pour filtre rayon).
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "latitude"   DOUBLE PRECISION;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "longitude"  DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "Candidate_postalCode_idx" ON "Candidate" ("postalCode");
