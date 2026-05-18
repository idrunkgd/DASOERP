-- Group ID partagé pour les OneOffs créés en récurrence (idempotent)
ALTER TABLE "OneOffCashflowEntry"
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "OneOffCashflowEntry_recurrenceGroupId_idx"
  ON "OneOffCashflowEntry"("recurrenceGroupId");
