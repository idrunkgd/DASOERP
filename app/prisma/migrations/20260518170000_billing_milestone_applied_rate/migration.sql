-- Snapshot du taux journalier au moment de la création/maj de la tranche.
-- IDEMPOTENT (IF NOT EXISTS) car la colonne existe déjà sur Neon depuis
-- une précédente application.
ALTER TABLE "BillingMilestone"
  ADD COLUMN IF NOT EXISTS "appliedDailyRate" DECIMAL(10, 2);
