ALTER TABLE "Course"
  ADD COLUMN "isCertifying" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "passThreshold" INTEGER NOT NULL DEFAULT 70,
  ADD COLUMN "certificateWording" TEXT;
