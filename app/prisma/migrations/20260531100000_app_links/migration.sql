-- =============================================================
-- APP LINKS : liens vers les applications externes utilisées
-- (Hetzner, Vercel, GitHub, Slack, ...).
-- Édition réservée aux admins, lecture pour tout user connecté.
-- =============================================================

CREATE TABLE IF NOT EXISTS "AppLink" (
  "id"          TEXT PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "url"         TEXT NOT NULL,
  "description" TEXT,
  "position"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdById" TEXT
);

DO $$ BEGIN
  ALTER TABLE "AppLink" ADD CONSTRAINT "AppLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AppLink_position_idx" ON "AppLink"("position");
