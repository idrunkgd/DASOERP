-- Bornes temporelles sur les dépenses/recettes récurrentes :
-- - startDate : à partir de quelle date la récurrence commence (sinon : illimité avant)
-- - endDate   : jusqu'à quelle date la récurrence est valable (sinon : illimité après)
-- Les deux nullables : permet la rétrocompat des récurrents existants (= toujours actifs).
ALTER TABLE "RecurringExpense"
  ADD COLUMN IF NOT EXISTS "startDate" DATE,
  ADD COLUMN IF NOT EXISTS "endDate"   DATE;

CREATE INDEX IF NOT EXISTS "RecurringExpense_startDate_idx"
  ON "RecurringExpense"("startDate");
CREATE INDEX IF NOT EXISTS "RecurringExpense_endDate_idx"
  ON "RecurringExpense"("endDate");
