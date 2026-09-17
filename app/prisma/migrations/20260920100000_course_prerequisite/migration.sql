-- Ajoute le prérequis inter-cours (BA5 nécessite BA4 réussi, etc.)
-- Idempotent : IF NOT EXISTS.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "prerequisiteCourseId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Course_prerequisiteCourseId_fkey'
      AND table_name = 'Course'
  ) THEN
    ALTER TABLE "Course"
      ADD CONSTRAINT "Course_prerequisiteCourseId_fkey"
      FOREIGN KEY ("prerequisiteCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Course_prerequisiteCourseId_idx" ON "Course"("prerequisiteCourseId");
