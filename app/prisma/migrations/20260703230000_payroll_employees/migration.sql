-- Module Payroll : 1 employé = 3 sorties mensuelles (net / précompte / ONSS)
-- Le cashflow agrège automatiquement pour n'afficher que 3 lignes globales.

CREATE TABLE "PayrollEmployee" (
    "id"                    TEXT NOT NULL,
    "firstName"             TEXT NOT NULL,
    "lastName"              TEXT NOT NULL,
    "role"                  TEXT,
    "startDate"             DATE NOT NULL,
    "endDate"               DATE,
    "monthlyNetPay"         DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "monthlyWithholdingTax" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "monthlyOnss"           DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "monthlyGrossReference" DECIMAL(10, 2),
    "monthsPerYear"         DECIMAL(5, 2) NOT NULL DEFAULT 13.92,
    "notes"                 TEXT,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollEmployee_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollEmployee_startDate_endDate_idx"
    ON "PayrollEmployee"("startDate", "endDate");
