-- Refonte congés : 3 catégories (Légaux/RTT/Année précédente), avec
-- table LeaveBalance qui garde l'historique année par année.

-- User : ajouter quota RTT (défaut 12)
ALTER TABLE "User" ADD COLUMN "rttDays" INTEGER NOT NULL DEFAULT 12;

-- Ajouter CARRIED_OVER dans LeaveType
ALTER TYPE "LeaveType" ADD VALUE IF NOT EXISTS 'CARRIED_OVER';

-- Nouvel enum pour la catégorie de bucket dans LeaveBalance
CREATE TYPE "LeaveBalanceType" AS ENUM ('ANNUAL_LEGAL', 'RTT', 'CARRIED_OVER');

-- Table LeaveBalance : quota par année × user × type
CREATE TABLE "LeaveBalance" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "year"      INTEGER NOT NULL,
    "type"      "LeaveBalanceType" NOT NULL,
    "entitled"  DECIMAL(4, 1) NOT NULL,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeaveBalance_userId_year_type_key"
    ON "LeaveBalance"("userId", "year", "type");
CREATE INDEX "LeaveBalance_userId_year_idx" ON "LeaveBalance"("userId", "year");

ALTER TABLE "LeaveBalance"
    ADD CONSTRAINT "LeaveBalance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : pour chaque user actif, crée les soldes de l'année en cours
-- (Légaux = annualLeaveDays, RTT = rttDays, CARRIED_OVER = 0). Ça permet
-- au module de démarrer avec une base cohérente sans intervention manuelle.
INSERT INTO "LeaveBalance" ("id", "userId", "year", "type", "entitled", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, id, EXTRACT(YEAR FROM CURRENT_DATE)::int,
  'ANNUAL_LEGAL'::"LeaveBalanceType", "annualLeaveDays"::decimal(4,1),
  NOW(), NOW()
FROM "User"
WHERE "active" = true
ON CONFLICT DO NOTHING;

INSERT INTO "LeaveBalance" ("id", "userId", "year", "type", "entitled", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text, id, EXTRACT(YEAR FROM CURRENT_DATE)::int,
  'RTT'::"LeaveBalanceType", "rttDays"::decimal(4,1),
  NOW(), NOW()
FROM "User"
WHERE "active" = true
ON CONFLICT DO NOTHING;
