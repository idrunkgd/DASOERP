-- Ajoute invoiceDate sur BillingMilestone — date d'émission de la facture.
-- En Belgique, la TVA est due sur base de la date de facture, pas de la date
-- d'encaissement. Le calcul TVA du cashflow doit se baser sur ce champ.

ALTER TABLE "BillingMilestone"
  ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3);

-- Migration data : pour les milestones déjà PAID ou TRANSMITTED, on remplit
-- invoiceDate avec transmittedAt (ou expectedAt comme fallback).
UPDATE "BillingMilestone"
SET "invoiceDate" = COALESCE("transmittedAt", "expectedAt")
WHERE "invoiceDate" IS NULL
  AND status IN ('TRANSMITTED', 'PAID');
