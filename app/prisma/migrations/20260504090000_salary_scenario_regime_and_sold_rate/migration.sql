-- AlterTable: ajout du régime hebdo et du TJM vendu sur les simulations
ALTER TABLE "CandidateSalaryScenario"
  ADD COLUMN "workingDaysPerWeek" DECIMAL(3, 1)  NOT NULL DEFAULT 5,
  ADD COLUMN "soldDailyRate"      DECIMAL(10, 2) NOT NULL DEFAULT 0;
