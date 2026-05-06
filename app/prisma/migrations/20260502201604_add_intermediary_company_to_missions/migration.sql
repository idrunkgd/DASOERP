-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "intermediaryCompanyId" TEXT,
ADD COLUMN     "intermediaryContactId" TEXT;

-- AlterTable
ALTER TABLE "MissionRequest" ADD COLUMN     "intermediaryCompanyId" TEXT,
ADD COLUMN     "intermediaryContactId" TEXT;

-- CreateIndex
CREATE INDEX "Mission_intermediaryCompanyId_idx" ON "Mission"("intermediaryCompanyId");

-- CreateIndex
CREATE INDEX "MissionRequest_intermediaryCompanyId_idx" ON "MissionRequest"("intermediaryCompanyId");

-- AddForeignKey
ALTER TABLE "MissionRequest" ADD CONSTRAINT "MissionRequest_intermediaryCompanyId_fkey" FOREIGN KEY ("intermediaryCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionRequest" ADD CONSTRAINT "MissionRequest_intermediaryContactId_fkey" FOREIGN KEY ("intermediaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_intermediaryCompanyId_fkey" FOREIGN KEY ("intermediaryCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_intermediaryContactId_fkey" FOREIGN KEY ("intermediaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
