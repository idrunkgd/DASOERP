-- Ajoute 1 jour de congé anniversaire au quota par défaut.
-- 1) Change le défaut de la colonne pour les nouveaux users
ALTER TABLE "User" ALTER COLUMN "annualLeaveDays" SET DEFAULT 21;

-- 2) Bump les users actifs qui ont encore 20 (défaut historique) → 21.
--    On ne touche pas aux users avec un quota custom (temps partiel, etc.).
UPDATE "User"
SET "annualLeaveDays" = 21
WHERE "annualLeaveDays" = 20
  AND "active" = true;

-- 3) Bump aussi le bucket ANNUAL_LEGAL de l'année en cours pour tous les
--    users dont le solde entitled vaut 20 (donc n'a pas été ajusté manuellement).
UPDATE "LeaveBalance"
SET "entitled" = 21
WHERE "type" = 'ANNUAL_LEGAL'
  AND "entitled" = 20
  AND "year" >= EXTRACT(YEAR FROM NOW())::int;
