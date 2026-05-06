-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "candidateId" TEXT,
ALTER COLUMN "applicationId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Interview_candidateId_scheduledAt_idx" ON "Interview"("candidateId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Interview_scheduledAt_idx" ON "Interview"("scheduledAt");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
