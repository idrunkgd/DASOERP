-- =============================================================
-- ONBOARDING + WIKI
-- - OnboardingTemplate / OnboardingTemplateItem : checklists templatables
--   par rôle (Admin/Manager/Commercial/Consultant/Finance) ou génériques.
-- - Onboarding / OnboardingItem : instance par user qui arrive, avec
--   suivi de progression et auto-création d'entretiens via reviewOffsets.
-- - WikiPage : pages markdown internes (procédures, méthodes, templates).
-- =============================================================

-- ── Templates ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OnboardingTemplate" (
  "id"            TEXT PRIMARY KEY,
  "name"          TEXT NOT NULL UNIQUE,
  "role"          "Role",
  "description"   TEXT,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "reviewOffsets" INTEGER[] NOT NULL DEFAULT ARRAY[1, 30, 90, 180]::INTEGER[],
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "OnboardingTemplateItem" (
  "id"               TEXT PRIMARY KEY,
  "templateId"       TEXT NOT NULL,
  "category"         TEXT NOT NULL,
  "title"            TEXT NOT NULL,
  "description"      TEXT,
  "defaultOwnerRole" "Role",
  "daysOffset"       INTEGER NOT NULL DEFAULT 0,
  "position"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "OnboardingTemplateItem"
    ADD CONSTRAINT "OnboardingTemplateItem_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OnboardingTemplateItem_templateId_position_idx"
  ON "OnboardingTemplateItem"("templateId", "position");

-- ── Instances ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Onboarding" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL UNIQUE,
  "templateId"  TEXT,
  "startDate"   DATE NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "notes"       TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "Onboarding"
    ADD CONSTRAINT "Onboarding_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Onboarding"
    ADD CONSTRAINT "Onboarding_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Onboarding"
    ADD CONSTRAINT "Onboarding_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Onboarding_status_idx" ON "Onboarding"("status");

CREATE TABLE IF NOT EXISTS "OnboardingItem" (
  "id"           TEXT PRIMARY KEY,
  "onboardingId" TEXT NOT NULL,
  "category"     TEXT NOT NULL,
  "title"        TEXT NOT NULL,
  "description"  TEXT,
  "position"     INTEGER NOT NULL DEFAULT 0,
  "ownerId"      TEXT,
  "dueDate"      DATE,
  "done"         BOOLEAN NOT NULL DEFAULT false,
  "doneAt"       TIMESTAMP(3),
  "doneById"     TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "OnboardingItem"
    ADD CONSTRAINT "OnboardingItem_onboardingId_fkey"
    FOREIGN KEY ("onboardingId") REFERENCES "Onboarding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OnboardingItem"
    ADD CONSTRAINT "OnboardingItem_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OnboardingItem"
    ADD CONSTRAINT "OnboardingItem_doneById_fkey"
    FOREIGN KEY ("doneById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "OnboardingItem_onboardingId_position_idx"
  ON "OnboardingItem"("onboardingId", "position");
CREATE INDEX IF NOT EXISTS "OnboardingItem_ownerId_done_idx"
  ON "OnboardingItem"("ownerId", "done");

-- ── Wiki ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WikiPage" (
  "id"          TEXT PRIMARY KEY,
  "slug"        TEXT NOT NULL UNIQUE,
  "title"       TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "category"    TEXT,
  "pinned"      BOOLEAN NOT NULL DEFAULT false,
  "authorId"    TEXT,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "WikiPage"
    ADD CONSTRAINT "WikiPage_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WikiPage"
    ADD CONSTRAINT "WikiPage_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "WikiPage_category_idx" ON "WikiPage"("category");
CREATE INDEX IF NOT EXISTS "WikiPage_pinned_updatedAt_idx" ON "WikiPage"("pinned", "updatedAt");

-- ── Seed minimal : un template générique avec des items types ───────────
-- (l'admin pourra l'éditer ensuite via /settings/onboarding-templates)
INSERT INTO "OnboardingTemplate" ("id", "name", "role", "description", "reviewOffsets", "updatedAt")
VALUES (
  'tpl_onboarding_default',
  'Onboarding standard',
  NULL,
  'Template par défaut pour toute nouvelle arrivée chez Dasolabs',
  ARRAY[1, 30, 90, 180]::INTEGER[],
  CURRENT_TIMESTAMP
)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "OnboardingTemplateItem"
  ("id", "templateId", "category", "title", "description", "daysOffset", "position", "updatedAt")
VALUES
  -- Administratif
  ('tpli_contract',       'tpl_onboarding_default', 'Administratif', 'Signer le contrat de travail',           NULL, -7,  10, CURRENT_TIMESTAMP),
  ('tpli_id_card',        'tpl_onboarding_default', 'Administratif', 'Copie carte d''identité + RIB',           NULL, -3,  20, CURRENT_TIMESTAMP),
  ('tpli_secu',           'tpl_onboarding_default', 'Administratif', 'Déclaration sécurité sociale (Dimona)',   NULL,  0,  30, CURRENT_TIMESTAMP),
  -- IT
  ('tpli_laptop',         'tpl_onboarding_default', 'IT',            'Préparer / commander le laptop',          NULL, -7, 110, CURRENT_TIMESTAMP),
  ('tpli_accounts',       'tpl_onboarding_default', 'IT',            'Créer les comptes (Google, Slack, GitHub)', NULL, -2, 120, CURRENT_TIMESTAMP),
  ('tpli_access_hub',     'tpl_onboarding_default', 'IT',            'Accès Dasohub + groupe d''accès assigné', NULL,  0, 130, CURRENT_TIMESTAMP),
  -- Formation
  ('tpli_tour',           'tpl_onboarding_default', 'Formation',     'Tour de l''application Dasohub',          NULL,  1, 210, CURRENT_TIMESTAMP),
  ('tpli_methods',        'tpl_onboarding_default', 'Formation',     'Brief méthodes/process internes',         NULL,  2, 220, CURRENT_TIMESTAMP),
  -- Intégration équipe
  ('tpli_welcome_lunch',  'tpl_onboarding_default', 'Intégration équipe', 'Déjeuner d''accueil avec l''équipe',  NULL,  1, 310, CURRENT_TIMESTAMP),
  ('tpli_buddy',          'tpl_onboarding_default', 'Intégration équipe', 'Assigner un buddy / référent',       NULL,  0, 320, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
