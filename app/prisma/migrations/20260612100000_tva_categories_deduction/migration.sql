-- =============================================================
-- Catégories TVA + déduction partielle (règles belges)
--
-- Contexte : la page /test/tva (computeVatReport) :
--   - ignorait complètement SupplierInvoice et ExpenseReport
--   - ne lisait que Purchase + BillingMilestone
--   - appliquait 100 % de déduction sur tout (faux pour voitures à 50 %,
--     restaurants à 0 %, frais représentation à 0 %, etc.)
--   - mettait tous les achats en case 81 (au lieu de 81/82/83)
--
-- Ce que cette migration ajoute :
--   1. enum SupplierInvoiceCategory (le modèle n'en avait pas)
--   2. SupplierInvoice.category
--   3. SupplierInvoice.vatDeductibleRateOverride (pour 100 % voiture pro)
--   4. ExpenseReport.vatDeductibleRateOverride
--   5. Purchase.vatRate / Purchase.vatAmount / Purchase.vatDeductibleRateOverride
--
-- Backfill : toutes les lignes existantes héritent de category=OTHER et
-- vatRate=21. La règle de déduction effective est calculée à la volée
-- dans lib/belgian-vat-rules.ts via une table de mapping (category → rate).
-- =============================================================

-- 1. enum SupplierInvoiceCategory
CREATE TYPE "SupplierInvoiceCategory" AS ENUM (
  'CAR_PURCHASE',
  'CAR_LEASE',
  'CAR_FUEL',
  'CAR_MAINTENANCE',
  'CAR_INSURANCE',
  'RESTAURANT',
  'HOTEL',
  'OFFICE_RENT',
  'UTILITIES',
  'SOFTWARE_SAAS',
  'SUBCONTRACTING',
  'OFFICE_SUPPLIES',
  'HARDWARE_SMALL',
  'HARDWARE_INVESTMENT',
  'PROFESSIONAL_SERVICES',
  'TRAINING',
  'TELECOM',
  'GIFT_LOW',
  'GIFT_HIGH',
  'REPRESENTATION',
  'OTHER'
);

-- 2. SupplierInvoice.category + override
ALTER TABLE "SupplierInvoice"
  ADD COLUMN "category" "SupplierInvoiceCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "vatDeductibleRateOverride" DECIMAL(5, 2);

-- 3. ExpenseReport override (catégorie déjà présente)
ALTER TABLE "ExpenseReport"
  ADD COLUMN "vatDeductibleRateOverride" DECIMAL(5, 2);

-- 4. Purchase : vatRate + vatAmount + override
--    On backfill vatAmount à partir de amount * 21 % pour les lignes existantes
--    (hypothèse historique avant le fix).
ALTER TABLE "Purchase"
  ADD COLUMN "vatRate" DECIMAL(5, 2) NOT NULL DEFAULT 21,
  ADD COLUMN "vatAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "vatDeductibleRateOverride" DECIMAL(5, 2);

UPDATE "Purchase"
SET "vatAmount" = ROUND("amount" * 0.21, 2)
WHERE "vatAmount" = 0;
