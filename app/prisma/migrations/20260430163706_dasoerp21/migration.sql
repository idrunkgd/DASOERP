/*
  Warnings:

  - A unique constraint covering the columns `[applicationId]` on the table `Offer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OfferMode" AS ENUM ('PROJECT', 'CONSULTING');

-- CreateEnum
CREATE TYPE "ProjectMode" AS ENUM ('PROJECT', 'CONSULTING');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('NEW', 'QUALIFYING', 'PRESENTING', 'CONTRACTED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('ACTIVE', 'ENGAGED', 'UNAVAILABLE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PRESENTED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InterviewKind" AS ENUM ('PHONE', 'VIDEO', 'ON_SITE', 'TECHNICAL', 'HR');

-- CreateEnum
CREATE TYPE "InterviewOutcome" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingFrequency" AS ENUM ('MONTHLY', 'WEEKLY', 'CUSTOM');

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "candidateId" TEXT;

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "missionRequestId" TEXT,
ADD COLUMN     "mode" "OfferMode" NOT NULL DEFAULT 'PROJECT',
ADD COLUMN     "parentOfferId" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "billingFrequency" "BillingFrequency" DEFAULT 'MONTHLY',
ADD COLUMN     "mode" "ProjectMode" NOT NULL DEFAULT 'PROJECT';

-- CreateTable
CREATE TABLE "MissionRequest" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'NEW',
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "ownerId" TEXT,
    "requiredSkills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seniority" TEXT,
    "workLocation" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "estimatedDays" INTEGER,
    "targetDailyRate" DECIMAL(10,2),
    "maxDailyRate" DECIMAL(10,2),
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "city" TEXT,
    "source" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsExperience" INTEGER,
    "seniority" TEXT,
    "spokenLanguages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dailyCost" DECIMAL(10,2),
    "hourlyCost" DECIMAL(10,2),
    "minDailyRate" DECIMAL(10,2),
    "status" "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
    "availableFrom" DATE,
    "notes" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionApplication" (
    "id" TEXT NOT NULL,
    "missionRequestId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "proposedDailyRate" DECIMAL(10,2),
    "dailyCost" DECIMAL(10,2),
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PRESENTED',
    "presentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "kind" "InterviewKind" NOT NULL DEFAULT 'VIDEO',
    "interviewers" TEXT,
    "location" TEXT,
    "feedback" TEXT,
    "outcome" "InterviewOutcome" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionRequest_reference_key" ON "MissionRequest"("reference");

-- CreateIndex
CREATE INDEX "MissionRequest_companyId_idx" ON "MissionRequest"("companyId");

-- CreateIndex
CREATE INDEX "MissionRequest_status_idx" ON "MissionRequest"("status");

-- CreateIndex
CREATE INDEX "Candidate_lastName_firstName_idx" ON "Candidate"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "MissionApplication_status_idx" ON "MissionApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MissionApplication_missionRequestId_candidateId_key" ON "MissionApplication"("missionRequestId", "candidateId");

-- CreateIndex
CREATE INDEX "Interview_applicationId_scheduledAt_idx" ON "Interview"("applicationId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_applicationId_key" ON "Offer"("applicationId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_parentOfferId_fkey" FOREIGN KEY ("parentOfferId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_missionRequestId_fkey" FOREIGN KEY ("missionRequestId") REFERENCES "MissionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MissionApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionRequest" ADD CONSTRAINT "MissionRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionRequest" ADD CONSTRAINT "MissionRequest_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionRequest" ADD CONSTRAINT "MissionRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionApplication" ADD CONSTRAINT "MissionApplication_missionRequestId_fkey" FOREIGN KEY ("missionRequestId") REFERENCES "MissionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionApplication" ADD CONSTRAINT "MissionApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
