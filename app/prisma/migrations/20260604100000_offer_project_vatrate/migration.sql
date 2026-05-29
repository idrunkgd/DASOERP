-- =============================================================
-- vatRate sur Offer et Project
-- TVA uniforme par offre/projet (pas par ligne). 21 = standard belge,
-- 0 = client exonéré (export, intra-EU reverse charge, etc.).
-- =============================================================

ALTER TABLE "Offer"   ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5, 2) NOT NULL DEFAULT 21;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5, 2) NOT NULL DEFAULT 21;
