-- Ajoute projectId au PurchaseOrder pour lier un bon de commande à un projet.
ALTER TABLE "PurchaseOrder" ADD COLUMN "projectId" TEXT;
CREATE INDEX "PurchaseOrder_projectId_idx" ON "PurchaseOrder"("projectId");
ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
