-- CreateEnum
CREATE TYPE "FleetBadgeType" AS ENUM ('ACCESS_BADGE', 'RECHARGE_CARD', 'TOLL_TAG', 'FUEL_CARD', 'PARKING_CARD', 'OTHER');

-- CreateTable
CREATE TABLE "FleetBadge" (
    "id" TEXT NOT NULL,
    "type" "FleetBadgeType" NOT NULL,
    "label" TEXT NOT NULL,
    "identifier" TEXT,
    "provider" TEXT,
    "monthlyFee" DECIMAL(10,2),
    "assignedUserId" TEXT,
    "assignedVehicleId" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FleetBadge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FleetBadge_type_idx" ON "FleetBadge"("type");
CREATE INDEX "FleetBadge_assignedUserId_idx" ON "FleetBadge"("assignedUserId");
CREATE INDEX "FleetBadge_assignedVehicleId_idx" ON "FleetBadge"("assignedVehicleId");
CREATE INDEX "FleetBadge_active_idx" ON "FleetBadge"("active");

ALTER TABLE "FleetBadge" ADD CONSTRAINT "FleetBadge_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FleetBadge" ADD CONSTRAINT "FleetBadge_assignedVehicleId_fkey" FOREIGN KEY ("assignedVehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
