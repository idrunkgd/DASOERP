-- Notes de frais : rattachement à un centre de coût + liste de participants
-- (utile pour les repas d'affaires et les frais de représentation).

ALTER TABLE "ExpenseReport"
  ADD COLUMN "costCenterId" TEXT,
  ADD COLUMN "attendees"    JSONB;

ALTER TABLE "ExpenseReport"
  ADD CONSTRAINT "ExpenseReport_costCenterId_fkey"
  FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ExpenseReport_costCenterId_idx" ON "ExpenseReport"("costCenterId");
