-- Ajoute coordonnées géographiques au candidat (pour filtre rayon).
-- Le code postal (postalCode) existe déjà dans la section contrats de Candidate,
-- on le réutilise tel quel — la migration ne le recrée pas.
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "latitude"  DOUBLE PRECISION;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
