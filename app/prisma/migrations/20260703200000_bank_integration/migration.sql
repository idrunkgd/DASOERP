-- Intégration bancaire GoCardless (ex-Nordigen)
-- Trois tables : BankConnection (requisition/consentement PSD2), BankAccount
-- (compte concret avec IBAN), BankTransaction (transactions rapatriées avec
-- statut de rapprochement contre les entrées cashflow existantes).

CREATE TYPE "BankConnectionStatus" AS ENUM (
  'PENDING', 'LINKED', 'EXPIRED', 'ERROR', 'REVOKED'
);
CREATE TYPE "BankTransactionStatus" AS ENUM (
  'UNRECONCILED', 'RECONCILED', 'IGNORED'
);

CREATE TABLE "BankConnection" (
    "id"               TEXT NOT NULL,
    "institutionId"    TEXT NOT NULL,
    "institutionName"  TEXT NOT NULL,
    "requisitionId"    TEXT NOT NULL,
    "status"           "BankConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "authorizationUrl" TEXT,
    "expiresAt"        TIMESTAMP(3),
    "createdById"      TEXT,
    "lastSyncAt"       TIMESTAMP(3),
    "lastSyncError"    TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankConnection_requisitionId_key" ON "BankConnection"("requisitionId");
CREATE INDEX "BankConnection_status_idx" ON "BankConnection"("status");
ALTER TABLE "BankConnection" ADD CONSTRAINT "BankConnection_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BankAccount" (
    "id"           TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "accountId"    TEXT NOT NULL,
    "iban"         TEXT,
    "currency"     TEXT NOT NULL DEFAULT 'EUR',
    "name"         TEXT,
    "ownerName"    TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankAccount_accountId_key" ON "BankAccount"("accountId");
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_connectionId_fkey"
    FOREIGN KEY ("connectionId") REFERENCES "BankConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BankTransaction" (
    "id"                       TEXT NOT NULL,
    "accountId"                TEXT NOT NULL,
    "internalTransactionId"    TEXT NOT NULL,
    "bookingDate"              DATE NOT NULL,
    "valueDate"                DATE,
    "amount"                   DECIMAL(12,2) NOT NULL,
    "currency"                 TEXT NOT NULL DEFAULT 'EUR',
    "counterpartyName"         TEXT,
    "counterpartyIban"         TEXT,
    "remittanceInfo"           TEXT,
    "status"                   "BankTransactionStatus" NOT NULL DEFAULT 'UNRECONCILED',
    "matchedRecurringMonthId"  TEXT,
    "matchedOneOffId"          TEXT,
    "matchedMilestoneId"       TEXT,
    "reconciledAt"             TIMESTAMP(3),
    "reconciledById"           TEXT,
    "notes"                    TEXT,
    "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankTransaction_accountId_internalTransactionId_key"
    ON "BankTransaction"("accountId", "internalTransactionId");
CREATE INDEX "BankTransaction_status_bookingDate_idx"
    ON "BankTransaction"("status", "bookingDate");
CREATE INDEX "BankTransaction_matchedRecurringMonthId_idx"
    ON "BankTransaction"("matchedRecurringMonthId");
CREATE INDEX "BankTransaction_matchedOneOffId_idx"
    ON "BankTransaction"("matchedOneOffId");
CREATE INDEX "BankTransaction_matchedMilestoneId_idx"
    ON "BankTransaction"("matchedMilestoneId");
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedRecurringMonthId_fkey"
    FOREIGN KEY ("matchedRecurringMonthId") REFERENCES "RecurringExpenseMonth"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedOneOffId_fkey"
    FOREIGN KEY ("matchedOneOffId") REFERENCES "OneOffCashflowEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedMilestoneId_fkey"
    FOREIGN KEY ("matchedMilestoneId") REFERENCES "BillingMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_reconciledById_fkey"
    FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
