-- Favoris topbar : jusqu'à 10 raccourcis par user, ordonnés par sortOrder
CREATE TABLE "UserFavorite" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "href"      TEXT NOT NULL,
  "icon"      TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFavorite_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "UserFavorite_userId_href_key" ON "UserFavorite"("userId", "href");
CREATE INDEX "UserFavorite_userId_sortOrder_idx" ON "UserFavorite"("userId", "sortOrder");
