-- Champ lastReviewedAt : date de la dernière vérification manuelle par un admin
ALTER TABLE "WikiArticle" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);

-- Table des images du wiki (captures d'écran, illustrations)
CREATE TABLE "WikiImage" (
    "id"           TEXT NOT NULL,
    "filename"     TEXT NOT NULL,
    "mimeType"     TEXT NOT NULL,
    "sizeBytes"    INTEGER NOT NULL,
    "data"         BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WikiImage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WikiImage_createdAt_idx" ON "WikiImage"("createdAt");

ALTER TABLE "WikiImage"
  ADD CONSTRAINT "WikiImage_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
