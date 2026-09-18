-- Cimetière des slugs de cours supprimés depuis l'UI.
-- Le seed check cette table pour ne PAS ressusciter un cours volontairement effacé.
CREATE TABLE IF NOT EXISTS "DeletedCourseSlug" (
  "slug"      TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedBy" TEXT,
  "reason"    TEXT,
  CONSTRAINT "DeletedCourseSlug_pkey" PRIMARY KEY ("slug")
);
