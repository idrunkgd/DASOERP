-- Marque les RecurringExpense "what-if" (projection candidat non engagé)
-- pour les isoler dans la colonne cashflow "avec simulation".
ALTER TABLE "RecurringExpense" ADD COLUMN IF NOT EXISTS "isSimulation" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "RecurringExpense_isSimulation_idx" ON "RecurringExpense"("isSimulation");

-- Rétro-tag : toute ligne existante avec category = 'SIMULATION' est marquée
-- isSimulation = true pour que les projections déjà créées ne polluent plus
-- la projection baseline.
UPDATE "RecurringExpense"
SET "isSimulation" = true
WHERE category = 'SIMULATION';
