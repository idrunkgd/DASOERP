-- Fil de discussion sur les propositions candidat (client ↔ Dasolabs)

CREATE TABLE IF NOT EXISTS "CandidateProposalComment" (
  "id"              TEXT PRIMARY KEY,
  "proposalId"      TEXT NOT NULL,
  "authorKind"      TEXT NOT NULL,
  "authorName"      TEXT NOT NULL,
  "authorUserId"    TEXT,
  "authorContactId" TEXT,
  "content"         TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CandidateProposalComment_proposalId_createdAt_idx"
  ON "CandidateProposalComment"("proposalId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CandidateProposalComment"
    ADD CONSTRAINT "CandidateProposalComment_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "CandidateProposal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateProposalComment"
    ADD CONSTRAINT "CandidateProposalComment_authorUserId_fkey"
    FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
