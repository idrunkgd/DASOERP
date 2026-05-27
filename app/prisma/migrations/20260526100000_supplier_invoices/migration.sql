-- =============================================================
-- SUPPLIER INVOICES — mirror Skwarel
-- =============================================================

DO $$ BEGIN
  CREATE TYPE "SupplierInvoiceStatus" AS ENUM (
    'DRAFT', 'PENDING', 'PAID', 'DISPUTED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SupplierInvoice" (
  "id"                TEXT PRIMARY KEY,
  "supplierCompanyId" TEXT,
  "supplierName"      TEXT NOT NULL,
  "invoiceNumber"     TEXT,
  "invoiceDate"       DATE NOT NULL,
  "dueDate"           DATE,
  "amountHt"          DECIMAL(12,2) NOT NULL,
  "vatRate"           DECIMAL(5,2) NOT NULL DEFAULT 21,
  "vatAmount"         DECIMAL(12,2) NOT NULL,
  "amountTtc"         DECIMAL(12,2) NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'EUR',
  "pdfUrl"            TEXT,
  "ocrPayload"        JSONB,
  "status"            "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "paidAt"            TIMESTAMP(3),
  "notes"             TEXT,
  "source"            TEXT NOT NULL DEFAULT 'manual',
  "createdById"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierCompanyId_fkey"
    FOREIGN KEY ("supplierCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "SupplierInvoice_status_idx"            ON "SupplierInvoice"("status");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_invoiceDate_idx"       ON "SupplierInvoice"("invoiceDate");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_supplierCompanyId_idx" ON "SupplierInvoice"("supplierCompanyId");
