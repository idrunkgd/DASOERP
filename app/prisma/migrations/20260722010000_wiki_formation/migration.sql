-- CreateEnum : niveau de difficulté d'un article
CREATE TYPE "WikiDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateTable : Catégorie / thématique (Cashflow, RH, Missions…)
CREATE TABLE "WikiCategory" (
    "id"                  TEXT NOT NULL,
    "key"                 TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "description"         TEXT NOT NULL,
    "icon"                TEXT,
    "colorClass"          TEXT,
    "orderIndex"          INTEGER NOT NULL DEFAULT 0,
    "requiredPermission"  TEXT NOT NULL,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WikiCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WikiCategory_key_key" ON "WikiCategory"("key");
CREATE INDEX "WikiCategory_orderIndex_idx" ON "WikiCategory"("orderIndex");

-- CreateTable : Article pas-à-pas (markdown)
CREATE TABLE "WikiArticle" (
    "id"                  TEXT NOT NULL,
    "categoryId"          TEXT NOT NULL,
    "slug"                TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "description"         TEXT NOT NULL,
    "content"             TEXT NOT NULL,
    "difficulty"          "WikiDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "estimatedMinutes"    INTEGER NOT NULL DEFAULT 5,
    "orderIndex"          INTEGER NOT NULL DEFAULT 0,
    "requiredPermission"  TEXT,
    "publishedAt"         TIMESTAMP(3),
    "updatedById"         TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WikiArticle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WikiArticle_categoryId_slug_key" ON "WikiArticle"("categoryId", "slug");
CREATE INDEX "WikiArticle_categoryId_orderIndex_idx" ON "WikiArticle"("categoryId", "orderIndex");
CREATE INDEX "WikiArticle_publishedAt_idx" ON "WikiArticle"("publishedAt");

ALTER TABLE "WikiArticle"
  ADD CONSTRAINT "WikiArticle_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "WikiCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WikiArticle"
  ADD CONSTRAINT "WikiArticle_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
