/*
  Warnings:

  - A unique constraint covering the columns `[portalUserId]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "portalUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_portalUserId_key" ON "Candidate"("portalUserId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
