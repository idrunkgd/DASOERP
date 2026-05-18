-- Enums
CREATE TYPE "RecurringFrequency" AS ENUM ('MONTHLY','QUARTERLY','SEMI_ANNUAL','ANNUAL','CUSTOM');
CREATE TYPE "CashflowStatus" AS ENUM ('PLANNED','PAID','SKIPPED');
CREATE TYPE "CashflowKind" AS ENUM ('EXPENSE','INCOME','COMMITMENT','SIMULATION');

-- Singleton settings
CREATE TABLE "CashflowSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "startingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "startingDate" DATE NOT NULL DEFAULT CURRENT_DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "CashflowSettings_pkey" PRIMARY KEY ("id")
);

-- Recurring expenses catalogue
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "isIncome" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "RecurringFrequency" NOT NULL DEFAULT 'MONTHLY',
    "paymentMonths" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecurringExpense_category_idx" ON "RecurringExpense"("category");
CREATE INDEX "RecurringExpense_isActive_idx" ON "RecurringExpense"("isActive");

-- Monthly overrides + status
CREATE TABLE "RecurringExpenseMonth" (
    "id" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amountOverride" DECIMAL(12,2),
    "status" "CashflowStatus" NOT NULL DEFAULT 'PLANNED',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpenseMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecurringExpenseMonth_recurringExpenseId_year_month_key" ON "RecurringExpenseMonth"("recurringExpenseId", "year", "month");
CREATE INDEX "RecurringExpenseMonth_year_month_idx" ON "RecurringExpenseMonth"("year", "month");
CREATE INDEX "RecurringExpenseMonth_status_idx" ON "RecurringExpenseMonth"("status");

-- One-off entries (expenses, incomes, commitments, simulations)
CREATE TABLE "OneOffCashflowEntry" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CashflowKind" NOT NULL,
    "status" "CashflowStatus" NOT NULL DEFAULT 'PLANNED',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "OneOffCashflowEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OneOffCashflowEntry_date_idx" ON "OneOffCashflowEntry"("date");
CREATE INDEX "OneOffCashflowEntry_kind_status_idx" ON "OneOffCashflowEntry"("kind", "status");

-- Foreign keys
ALTER TABLE "CashflowSettings"
  ADD CONSTRAINT "CashflowSettings_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringExpense"
  ADD CONSTRAINT "RecurringExpense_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecurringExpenseMonth"
  ADD CONSTRAINT "RecurringExpenseMonth_recurringExpenseId_fkey"
  FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OneOffCashflowEntry"
  ADD CONSTRAINT "OneOffCashflowEntry_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
