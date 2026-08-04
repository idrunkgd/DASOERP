-- Extension ContactInteraction pour supporter les tâches (todos) assignées
-- avec date d'échéance et statut complété.
ALTER TABLE "ContactInteraction"
  ADD COLUMN "assigneeId"  TEXT,
  ADD COLUMN "dueAt"       TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "ContactInteraction"
  ADD CONSTRAINT "ContactInteraction_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL;

CREATE INDEX "ContactInteraction_assigneeId_completedAt_idx"
  ON "ContactInteraction"("assigneeId", "completedAt");
CREATE INDEX "ContactInteraction_dueAt_idx"
  ON "ContactInteraction"("dueAt");
