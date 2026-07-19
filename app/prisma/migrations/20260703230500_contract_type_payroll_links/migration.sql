-- Contrat EMPLOYEE / FREELANCE sur Candidate + User + liens optionnels
-- de PayrollEmployee vers la source (Candidate ou User).

CREATE TYPE "ContractType" AS ENUM ('EMPLOYEE', 'FREELANCE');

ALTER TABLE "Candidate" ADD COLUMN "contractType" "ContractType";
ALTER TABLE "User"      ADD COLUMN "contractType" "ContractType";

CREATE INDEX "Candidate_contractType_idx" ON "Candidate"("contractType");

ALTER TABLE "PayrollEmployee" ADD COLUMN "candidateId" TEXT;
ALTER TABLE "PayrollEmployee" ADD COLUMN "userId"      TEXT;

CREATE UNIQUE INDEX "PayrollEmployee_candidateId_key" ON "PayrollEmployee"("candidateId");
CREATE UNIQUE INDEX "PayrollEmployee_userId_key"      ON "PayrollEmployee"("userId");

ALTER TABLE "PayrollEmployee" ADD CONSTRAINT "PayrollEmployee_candidateId_fkey"
    FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollEmployee" ADD CONSTRAINT "PayrollEmployee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
