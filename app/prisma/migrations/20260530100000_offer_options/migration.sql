-- =============================================================
-- OFFER OPTIONS : blocs nommés (presta + matériel) proposés en plus du devis
-- Affichés en page 2bis du PDF si présents.
-- =============================================================

CREATE TABLE IF NOT EXISTS "OfferOption" (
  "id"          TEXT PRIMARY KEY,
  "offerId"     TEXT NOT NULL,
  "position"    INTEGER NOT NULL DEFAULT 0,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "totalSell"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalCost"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "OfferOption" ADD CONSTRAINT "OfferOption_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OfferOption_offerId_position_idx"
  ON "OfferOption"("offerId", "position");

-- Ajout du lien optionId sur OfferLine
ALTER TABLE "OfferLine" ADD COLUMN IF NOT EXISTS "optionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "OfferLine" ADD CONSTRAINT "OfferLine_optionId_fkey"
    FOREIGN KEY ("optionId") REFERENCES "OfferOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OfferLine_optionId_idx" ON "OfferLine"("optionId");
