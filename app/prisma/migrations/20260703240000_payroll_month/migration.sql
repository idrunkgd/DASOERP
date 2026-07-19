-- Statut PAID par cellule (mois × type) pour les 3 lignes payroll agrégées
-- du cashflow. Permet de clôturer le passé versement par versement.

CREATE TYPE "PayrollKind" AS ENUM ('NET_PAY', 'WITHHOLDING_TAX', 'ONSS');

CREATE TABLE "PayrollMonth" (
    "id"             TEXT NOT NULL,
    "year"           INTEGER NOT NULL,
    "month"          INTEGER NOT NULL,
    "kind"           "PayrollKind" NOT NULL,
    "status"         "CashflowStatus" NOT NULL DEFAULT 'PLANNED',
    "paidAt"         TIMESTAMP(3),
    "amountOverride" DECIMAL(12, 2),
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollMonth_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollMonth_year_month_kind_key"
    ON "PayrollMonth"("year", "month", "kind");
CREATE INDEX "PayrollMonth_status_idx" ON "PayrollMonth"("status");
