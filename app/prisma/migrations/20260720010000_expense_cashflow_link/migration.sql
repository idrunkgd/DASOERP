-- Lien 1↔1 optionnel entre une note de frais approuvée et l'entrée
-- OneOffCashflowEntry qui matérialise sa sortie de cash (planifiée à
-- la fin du mois de la dépense). Cascade delete : supprimer la note
-- nettoie automatiquement l'entrée cashflow.

ALTER TABLE "OneOffCashflowEntry"
  ADD COLUMN "expenseReportId" TEXT;

CREATE UNIQUE INDEX "OneOffCashflowEntry_expenseReportId_key"
  ON "OneOffCashflowEntry"("expenseReportId");

ALTER TABLE "OneOffCashflowEntry"
  ADD CONSTRAINT "OneOffCashflowEntry_expenseReportId_fkey"
  FOREIGN KEY ("expenseReportId") REFERENCES "ExpenseReport"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
