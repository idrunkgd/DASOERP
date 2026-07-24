-- Enums flotte
CREATE TYPE "VehicleCategory" AS ENUM ('LEASING', 'OWNED');
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'RETURNED', 'SOLD', 'ARCHIVED');

-- Table Vehicle
CREATE TABLE "Vehicle" (
  "id"                TEXT NOT NULL,
  "plate"             TEXT NOT NULL,
  "brand"             TEXT NOT NULL,
  "model"             TEXT NOT NULL,
  "vin"               TEXT,
  "category"          "VehicleCategory" NOT NULL,
  "status"            "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
  "commissioningDate" DATE,
  "releaseDate"       DATE,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");
CREATE INDEX "Vehicle_category_idx" ON "Vehicle"("category");

-- Table LeasingContract
CREATE TABLE "LeasingContract" (
  "id"                  TEXT NOT NULL,
  "vehicleId"           TEXT NOT NULL,
  "lessor"              TEXT NOT NULL,
  "contractRef"         TEXT,
  "startDate"           DATE NOT NULL,
  "endDate"             DATE NOT NULL,
  "monthlyAmount"       DECIMAL(10,2) NOT NULL,
  "kmIncludedYear"      INTEGER,
  "notes"               TEXT,
  "recurringExpenseId"  TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeasingContract_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeasingContract_vehicleId_key" ON "LeasingContract"("vehicleId");
CREATE UNIQUE INDEX "LeasingContract_recurringExpenseId_key" ON "LeasingContract"("recurringExpenseId");
CREATE INDEX "LeasingContract_lessor_idx" ON "LeasingContract"("lessor");
ALTER TABLE "LeasingContract" ADD CONSTRAINT "LeasingContract_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Table VehicleAssignment
CREATE TABLE "VehicleAssignment" (
  "id"          TEXT NOT NULL,
  "vehicleId"   TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "startDate"   DATE NOT NULL,
  "endDate"     DATE,
  "startKm"     INTEGER,
  "endKm"       INTEGER,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VehicleAssignment_vehicleId_endDate_idx" ON "VehicleAssignment"("vehicleId", "endDate");
CREATE INDEX "VehicleAssignment_userId_endDate_idx" ON "VehicleAssignment"("userId", "endDate");
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
