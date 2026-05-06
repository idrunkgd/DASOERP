-- CreateEnum
CREATE TYPE "MissionExecutionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'EXTENDED', 'COMPLETED', 'CANCELLED', 'ON_HOLD');

-- AlterTable
ALTER TABLE "BillingMilestone" ADD COLUMN     "missionId" TEXT;

-- AlterTable
ALTER TABLE "PlanningEntry" ADD COLUMN     "missionId" TEXT;

-- AlterTable
ALTER TABLE "TimesheetEntry" ADD COLUMN     "missionId" TEXT;

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "missionRequestId" TEXT NOT NULL,
    "applicationId" TEXT,
    "consultantId" TEXT,
    "companyId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "actualEndDate" DATE,
    "estimatedDays" INTEGER,
    "dailyRate" DECIMAL(10,2) NOT NULL,
    "dailyCost" DECIMAL(10,2) NOT NULL,
    "workLocation" TEXT,
    "billingFrequency" "BillingFrequency" NOT NULL DEFAULT 'MONTHLY',
    "status" "MissionExecutionStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mission_reference_key" ON "Mission"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_applicationId_key" ON "Mission"("applicationId");

-- CreateIndex
CREATE INDEX "Mission_consultantId_status_idx" ON "Mission"("consultantId", "status");

-- CreateIndex
CREATE INDEX "Mission_companyId_idx" ON "Mission"("companyId");

-- CreateIndex
CREATE INDEX "Mission_status_endDate_idx" ON "Mission"("status", "endDate");

-- CreateIndex
CREATE INDEX "BillingMilestone_missionId_idx" ON "BillingMilestone"("missionId");

-- AddForeignKey
ALTER TABLE "BillingMilestone" ADD CONSTRAINT "BillingMilestone_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_missionRequestId_fkey" FOREIGN KEY ("missionRequestId") REFERENCES "MissionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MissionApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
