-- CreateTable
CREATE TABLE "CandidateSalaryScenario" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT,
    "label" TEXT NOT NULL,
    "grossMonthly" DECIMAL(10,2) NOT NULL,
    "monthsPerYear" DECIMAL(5,2) NOT NULL DEFAULT 13.92,
    "employerChargesPct" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "workingDaysPerYear" INTEGER NOT NULL DEFAULT 220,
    "carMonthlyTco" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mealVoucherEmployerPerDay" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "ecoVouchersAnnual" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "groupInsurancePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hospitalInsuranceAnnual" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "phoneInternetAnnual" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "netExpensesMonthly" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "targetMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "totalAnnualCost" DECIMAL(12,2) NOT NULL,
    "costPerDay" DECIMAL(10,2) NOT NULL,
    "billableRate" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSalaryScenario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateSalaryScenario_candidateId_idx" ON "CandidateSalaryScenario"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateSalaryScenario_createdAt_idx" ON "CandidateSalaryScenario"("createdAt");

-- AddForeignKey
ALTER TABLE "CandidateSalaryScenario"
  ADD CONSTRAINT "CandidateSalaryScenario_candidateId_fkey"
  FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSalaryScenario"
  ADD CONSTRAINT "CandidateSalaryScenario_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
