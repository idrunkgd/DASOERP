-- Contact <-> Company : rendre la relation N:N via ContactCompany.
-- On garde Contact.companyId comme "société principale" (rétro-compat).
-- La table de liaison est backfillée à partir des Contact.companyId
-- existants avec isPrimary = true.

CREATE TABLE "ContactCompany" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactCompany_pkey" PRIMARY KEY ("id")
);

-- Un contact ne peut pas être lié deux fois à la même société.
CREATE UNIQUE INDEX "ContactCompany_contactId_companyId_key"
    ON "ContactCompany"("contactId", "companyId");

CREATE INDEX "ContactCompany_companyId_idx" ON "ContactCompany"("companyId");
CREATE INDEX "ContactCompany_contactId_isPrimary_idx"
    ON "ContactCompany"("contactId", "isPrimary");

ALTER TABLE "ContactCompany" ADD CONSTRAINT "ContactCompany_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactCompany" ADD CONSTRAINT "ContactCompany_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill : chaque contact avec une companyId reçoit un ContactCompany
-- correspondant, jobTitle recopié depuis Contact.jobTitle, isPrimary=true.
-- gen_random_uuid() nécessite l'extension pgcrypto ; on utilise md5(random())
-- concaténé pour rester compatible même sans extension activée.
INSERT INTO "ContactCompany" ("id", "contactId", "companyId", "jobTitle", "isPrimary")
SELECT
    'cckL_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20),
    c."id",
    c."companyId",
    c."jobTitle",
    true
FROM "Contact" c
WHERE c."companyId" IS NOT NULL;
