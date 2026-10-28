-- Ajoute un FK User.cvContactUserId → User (self-reference) pour choisir
-- un point de contact depuis la liste des users HUB plutôt que de saisir
-- 4 champs libres. Les champs legacy cvContactName/Email/Phone restent
-- pour la compat.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "cvContactUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'User_cvContactUserId_fkey' AND table_name = 'User'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_cvContactUserId_fkey"
    FOREIGN KEY ("cvContactUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
