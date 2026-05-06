-- AlterTable: ajout du "reste à faire" sur Project
ALTER TABLE "Project"
  ADD COLUMN "remainingTimeH"       DECIMAL(8, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "remainingUpdatedAt"   TIMESTAMP(3),
  ADD COLUMN "remainingUpdatedById" TEXT;

-- AddForeignKey
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_remainingUpdatedById_fkey"
  FOREIGN KEY ("remainingUpdatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
