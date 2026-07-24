-- Photo optionnelle par véhicule (base64 URL ou lien externe)
ALTER TABLE "Vehicle" ADD COLUMN "photoUrl" TEXT;

-- Catégorie cashflow personnalisable pour la ligne récurrente auto-générée
ALTER TABLE "LeasingContract" ADD COLUMN "cashflowCategory" TEXT;

-- Lien Document → Vehicle (permet d'attacher contrat leasing PDF, carte grise, etc.)
ALTER TABLE "Document" ADD COLUMN "vehicleId" TEXT;
ALTER TABLE "Document"
  ADD CONSTRAINT "Document_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Document_vehicleId_idx" ON "Document"("vehicleId");
