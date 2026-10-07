-- Création de la table CompanySite — modélise les N sites d'une société
-- (usines, dépôts, sièges, bureaux). Idempotent via IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "CompanySite" (
    "id"                 TEXT NOT NULL,
    "companyId"          TEXT NOT NULL,
    "name"               TEXT NOT NULL,
    "siteType"           TEXT,
    "street"             TEXT,
    "postalCode"         TEXT,
    "city"               TEXT,
    "country"            TEXT,
    "phone"              TEXT,
    "email"              TEXT,
    "establishmentUnit"  TEXT,
    "verificationStatus" TEXT,
    "sourceUrl"          TEXT,
    "notes"              TEXT,
    "isPrimary"          BOOLEAN NOT NULL DEFAULT false,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySite_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompanySite_companyId_idx" ON "CompanySite"("companyId");
CREATE INDEX IF NOT EXISTS "CompanySite_city_idx"      ON "CompanySite"("city");
CREATE INDEX IF NOT EXISTS "CompanySite_postalCode_idx" ON "CompanySite"("postalCode");

-- FK vers Company avec cascade — supprimer une société supprime ses sites
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CompanySite_companyId_fkey' AND table_name = 'CompanySite'
  ) THEN
    ALTER TABLE "CompanySite"
    ADD CONSTRAINT "CompanySite_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
