-- Chartes & politiques à signer par les employés

CREATE TABLE "SignableDocument" (
  "id"          TEXT PRIMARY KEY,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "category"    TEXT,
  "mandatory"   BOOLEAN NOT NULL DEFAULT true,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  CONSTRAINT "SignableDocument_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE INDEX "SignableDocument_active_idx"   ON "SignableDocument"("active");
CREATE INDEX "SignableDocument_category_idx" ON "SignableDocument"("category");

CREATE TABLE "SignableDocumentVersion" (
  "id"           TEXT PRIMARY KEY,
  "documentId"   TEXT NOT NULL,
  "versionNum"   INTEGER NOT NULL DEFAULT 1,
  "filePath"     TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL,
  "size"         INTEGER NOT NULL,
  "releasedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"        TEXT,
  "createdById"  TEXT,
  CONSTRAINT "SignableDocumentVersion_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "SignableDocument"("id") ON DELETE CASCADE,
  CONSTRAINT "SignableDocumentVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "SignableDocumentVersion_documentId_versionNum_key"
  ON "SignableDocumentVersion"("documentId", "versionNum");
CREATE INDEX "SignableDocumentVersion_documentId_idx" ON "SignableDocumentVersion"("documentId");

CREATE TABLE "DocumentSignature" (
  "id"             TEXT PRIMARY KEY,
  "documentId"     TEXT NOT NULL,
  "versionId"      TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "assignedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedById"   TEXT,
  "signedAt"       TIMESTAMP(3),
  "signatureText"  TEXT,
  "signatureIp"    TEXT,
  "signatureUA"    TEXT,
  "declinedAt"     TIMESTAMP(3),
  "declinedReason" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentSignature_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "SignableDocument"("id") ON DELETE CASCADE,
  CONSTRAINT "DocumentSignature_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "SignableDocumentVersion"("id") ON DELETE CASCADE,
  CONSTRAINT "DocumentSignature_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "DocumentSignature_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "DocumentSignature_userId_versionId_key"
  ON "DocumentSignature"("userId", "versionId");
CREATE INDEX "DocumentSignature_userId_status_idx"     ON "DocumentSignature"("userId", "status");
CREATE INDEX "DocumentSignature_documentId_status_idx" ON "DocumentSignature"("documentId", "status");
CREATE INDEX "DocumentSignature_versionId_status_idx"  ON "DocumentSignature"("versionId", "status");
