-- Ajout de la relation Opportunity → Contact (référent commercial)
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Opportunity_contactId_idx" ON "Opportunity"("contactId");
