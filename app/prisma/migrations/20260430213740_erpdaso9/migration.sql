/*
  Warnings:

  - A unique constraint covering the columns `[missionRequestId,consultantId]` on the table `MissionApplication` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MissionApplication" ADD COLUMN     "consultantId" TEXT,
ALTER COLUMN "candidateId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MissionApplication_missionRequestId_consultantId_key" ON "MissionApplication"("missionRequestId", "consultantId");

-- AddForeignKey
ALTER TABLE "MissionApplication" ADD CONSTRAINT "MissionApplication_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
