-- CreateEnum
CREATE TYPE "CostCenterKind" AS ENUM ('SALES', 'LEAVE', 'MEETING', 'ADMIN', 'TRAINING', 'RND', 'OTHER');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CSV_IMPORT';

-- AlterTable
ALTER TABLE "OfferLine" ADD COLUMN     "marginPctInput" DECIMAL(5,2),
ADD COLUMN     "profileId" TEXT;

-- AlterTable
ALTER TABLE "PlanningEntry" ADD COLUMN     "costCenterId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TimesheetEntry" ADD COLUMN     "costCenterId" TEXT,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ServiceProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hourlyCost" DECIMAL(10,2) NOT NULL,
    "dailyCost" DECIMAL(10,2) NOT NULL,
    "hourlySell" DECIMAL(10,2) NOT NULL,
    "dailySell" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCenter" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CostCenterKind" NOT NULL DEFAULT 'OTHER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "countsAsBillable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostCenter_code_key" ON "CostCenter"("code");

-- AddForeignKey
ALTER TABLE "OfferLine" ADD CONSTRAINT "OfferLine_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ServiceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningEntry" ADD CONSTRAINT "PlanningEntry_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
