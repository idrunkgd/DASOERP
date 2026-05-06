-- Renommage : les colonnes "Annual" passent en "Monthly" pour refléter
-- la sémantique réelle attendue (saisie mensuelle, multiplication × 12
-- effectuée au calcul).
-- Les valeurs existantes (annuelles) sont divisées par 12 pour conserver
-- le même coût total une fois la nouvelle formule appliquée.
ALTER TABLE "CandidateSalaryScenario"
  RENAME COLUMN "hospitalInsuranceAnnual" TO "hospitalInsuranceMonthly";
ALTER TABLE "CandidateSalaryScenario"
  RENAME COLUMN "phoneInternetAnnual"     TO "phoneInternetMonthly";

UPDATE "CandidateSalaryScenario"
SET
  "hospitalInsuranceMonthly" = ROUND("hospitalInsuranceMonthly" / 12, 2),
  "phoneInternetMonthly"     = ROUND("phoneInternetMonthly"     / 12, 2);
