-- Suivi de mission : notes rapides (audience client/consultant) + lien
-- des documents vers une mission avec audience.

-- ─── Document.missionId + audience ────────────────────────────────────
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "missionId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "audience" TEXT;

DO $$ BEGIN
  ALTER TABLE "Document"
    ADD CONSTRAINT "Document_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Document_missionId_idx" ON "Document"("missionId");

-- ─── Table MissionNote ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MissionNote" (
  "id"        TEXT PRIMARY KEY,
  "missionId" TEXT NOT NULL,
  "authorId"  TEXT,
  "audience"  TEXT NOT NULL DEFAULT 'CONSULTANT',
  "content"   TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "MissionNote"
    ADD CONSTRAINT "MissionNote_missionId_fkey"
    FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MissionNote"
    ADD CONSTRAINT "MissionNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "MissionNote_missionId_audience_idx" ON "MissionNote"("missionId", "audience");
CREATE INDEX IF NOT EXISTS "MissionNote_createdAt_idx" ON "MissionNote"("createdAt");

-- ─── Table CandidateInteraction (timeline appels/mails/meetings) ──────
CREATE TABLE IF NOT EXISTS "CandidateInteraction" (
  "id"          TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "userId"      TEXT,
  "kind"        TEXT NOT NULL DEFAULT 'note',
  "subject"     TEXT NOT NULL,
  "body"        TEXT,
  "occurredAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "CandidateInteraction"
    ADD CONSTRAINT "CandidateInteraction_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CandidateInteraction"
    ADD CONSTRAINT "CandidateInteraction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "CandidateInteraction_candidateId_occurredAt_idx" ON "CandidateInteraction"("candidateId", "occurredAt");

-- ─── Table CandidateRecruitmentStage (pipeline recrutement) ───────────
CREATE TABLE IF NOT EXISTS "CandidateRecruitmentStage" (
  "id"          TEXT PRIMARY KEY,
  "candidateId" TEXT NOT NULL,
  "stageKey"    TEXT NOT NULL,
  "done"        BOOLEAN NOT NULL DEFAULT false,
  "doneAt"      TIMESTAMP(3),
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$ BEGIN
  ALTER TABLE "CandidateRecruitmentStage"
    ADD CONSTRAINT "CandidateRecruitmentStage_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CandidateRecruitmentStage_candidateId_stageKey_key" ON "CandidateRecruitmentStage"("candidateId", "stageKey");
CREATE INDEX IF NOT EXISTS "CandidateRecruitmentStage_candidateId_idx" ON "CandidateRecruitmentStage"("candidateId");
