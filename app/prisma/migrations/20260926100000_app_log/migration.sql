-- Log runtime des erreurs applicatives — table alimentée par lib/app-log.ts
-- et consultée sur /logs. Rétention 30 jours (nettoyage manuel ou cron).
CREATE TABLE IF NOT EXISTS "AppLog" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "level"     TEXT NOT NULL,
  "message"   TEXT NOT NULL,
  "stack"     TEXT,
  "path"      TEXT,
  "userId"    TEXT,
  "meta"      JSONB
);
CREATE INDEX IF NOT EXISTS "AppLog_createdAt_idx" ON "AppLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AppLog_level_createdAt_idx" ON "AppLog"("level", "createdAt");
CREATE INDEX IF NOT EXISTS "AppLog_userId_idx" ON "AppLog"("userId");
ALTER TABLE "AppLog" ADD CONSTRAINT "AppLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
