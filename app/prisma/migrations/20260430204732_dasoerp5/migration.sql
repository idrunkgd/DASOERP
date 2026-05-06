/*
  Warnings:

  - A unique constraint covering the columns `[previousVersionId]` on the table `Offer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ConsultantReviewKind" AS ENUM ('ONBOARDING', 'CHECK_IN', 'ANNUAL_REVIEW', 'END_OF_MISSION', 'PERFORMANCE', 'CAREER', 'OFFBOARDING', 'OTHER_REVIEW');

-- CreateEnum
CREATE TYPE "ConsultantReviewOutcome" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "previousVersionId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ConsultantReview" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "conductedById" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "kind" "ConsultantReviewKind" NOT NULL DEFAULT 'CHECK_IN',
    "projectId" TEXT,
    "feedback" TEXT,
    "privateNotes" TEXT,
    "goals" TEXT,
    "outcome" "ConsultantReviewOutcome" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultantReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultantReview_subjectId_scheduledAt_idx" ON "ConsultantReview"("subjectId", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_previousVersionId_key" ON "Offer"("previousVersionId");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantReview" ADD CONSTRAINT "ConsultantReview_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantReview" ADD CONSTRAINT "ConsultantReview_conductedById_fkey" FOREIGN KEY ("conductedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultantReview" ADD CONSTRAINT "ConsultantReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
