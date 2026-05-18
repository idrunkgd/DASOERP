-- Ajoute un lien direct facultatif vers Company sur BillingMilestone,
-- pour les milestones standalone non rattachés à un offer/project/mission.
ALTER TABLE "BillingMilestone"
  ADD COLUMN "companyId" TEXT;

CREATE INDEX "BillingMilestone_companyId_idx" ON "BillingMilestone"("companyId");

ALTER TABLE "BillingMilestone"
  ADD CONSTRAINT "BillingMilestone_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
