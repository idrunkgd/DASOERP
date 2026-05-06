-- CreateTable
CREATE TABLE "CandidateExperience" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateExperience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateExperience_candidateId_startDate_idx" ON "CandidateExperience"("candidateId", "startDate");

-- AddForeignKey
ALTER TABLE "CandidateExperience" ADD CONSTRAINT "CandidateExperience_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
