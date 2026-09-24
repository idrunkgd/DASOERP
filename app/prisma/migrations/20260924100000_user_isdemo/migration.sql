-- Marqueur "utilisateur de démo" — pour distinguer les faux profils créés par
-- seed-demo-consultant.mjs (démonstration des modules HUB aux employés) des
-- vrais consultants Dasolabs.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "User_isDemo_idx" ON "User"("isDemo");
