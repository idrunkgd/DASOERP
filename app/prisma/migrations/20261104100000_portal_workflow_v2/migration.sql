-- Workflow V2 pour le portail : entretien 1 → entretien 2 → shortlist → accepté
-- Les portails existants restent en LEGACY (statut 'PROPOSED' + 3 boutons simples).

ALTER TABLE "ClientPortal"
  ADD COLUMN IF NOT EXISTS "workflowVersion" TEXT NOT NULL DEFAULT 'LEGACY';

ALTER TABLE "CandidateProposal"
  ADD COLUMN IF NOT EXISTS "interview1Slots"       JSONB,
  ADD COLUMN IF NOT EXISTS "interview1ConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interview1DoneAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interview1Notes"       TEXT,
  ADD COLUMN IF NOT EXISTS "interview2Slots"       JSONB,
  ADD COLUMN IF NOT EXISTS "interview2ConfirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interview2DoneAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "interview2Notes"       TEXT,
  ADD COLUMN IF NOT EXISTS "shortlistedAt"         TIMESTAMP(3);
