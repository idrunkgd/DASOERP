-- Ajout du package / avantages directement sur PayrollEmployee pour permettre
-- de configurer la rémunération complète sans forcément passer par un scénario
-- CandidateSalaryScenario (utile pour les salariés internes non ex-candidats).

ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "carMonthlyTco"             DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "mealVoucherEmployerPerDay" DECIMAL(6, 2)  NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "ecoVouchersAnnual"         DECIMAL(8, 2)  NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "hospitalInsuranceMonthly"  DECIMAL(8, 2)  NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "phoneInternetMonthly"      DECIMAL(8, 2)  NOT NULL DEFAULT 0;
ALTER TABLE "PayrollEmployee" ADD COLUMN IF NOT EXISTS "netExpensesMonthly"        DECIMAL(8, 2)  NOT NULL DEFAULT 0;
