-- Ajout du type (kind) sur les opportunités : CONSULTING ou PROJECT.
-- Réutilise l'enum OfferMode existant.

ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "kind" "OfferMode" NOT NULL DEFAULT 'CONSULTING';

CREATE INDEX IF NOT EXISTS "Opportunity_kind_idx" ON "Opportunity"("kind");
