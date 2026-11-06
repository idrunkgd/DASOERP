-- Ajoute une catégorie de rangement sur Document (CONTRACT, RH, PROJECT…).
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "category" TEXT;
CREATE INDEX IF NOT EXISTS "Document_category_idx" ON "Document" ("category");
