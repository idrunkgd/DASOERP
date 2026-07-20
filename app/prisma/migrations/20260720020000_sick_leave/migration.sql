-- Arrêts maladie déclarés par les consultants (avec certificat en PJ).
-- Pas de workflow d'approbation : la déclaration est factuelle (preuve médicale).

CREATE TABLE "SickLeave" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "startDate"      DATE NOT NULL,
    "endDate"        DATE NOT NULL,
    "reason"         TEXT,
    "certificateUrl" TEXT,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SickLeave_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SickLeave_userId_startDate_idx"       ON "SickLeave"("userId", "startDate");
CREATE INDEX "SickLeave_startDate_endDate_idx"      ON "SickLeave"("startDate", "endDate");

ALTER TABLE "SickLeave"
  ADD CONSTRAINT "SickLeave_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
