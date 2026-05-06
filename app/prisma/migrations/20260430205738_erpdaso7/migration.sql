/*
  Warnings:

  - A unique constraint covering the columns `[convertedToUserId]` on the table `Candidate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "convertedToUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "linkedinUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "seniority" TEXT,
ADD COLUMN     "spokenLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "yearsExperience" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_convertedToUserId_key" ON "Candidate"("convertedToUserId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_convertedToUserId_fkey" FOREIGN KEY ("convertedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
