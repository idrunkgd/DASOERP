-- Ajoute la couche IT/OT/UNS où un cours est positionné dans le stack industriel.
-- Modifiable par l'admin via drag-drop sur la vue architecture.
-- Idempotent : IF NOT EXISTS.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "layerKey" TEXT;
