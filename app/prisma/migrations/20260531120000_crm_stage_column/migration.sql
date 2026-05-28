-- =============================================================
-- CRM STAGE : colonne dédiée pour le kanban CRM sur les entités qui
-- n'ont pas la même granularité que les 7 stages du board.
--   * MissionRequest, Offer : les enums status sont plus pauvres que les
--     stages kanban → on perdait des changements quand 2 stages mappaient
--     vers le même status (ex: PROPOSED ↔ NEGOTIATING pour Offer/Mission).
--   * Project : tous les status "ouverts" pointaient vers TO_START → on ne
--     pouvait pas distinguer NEW de QUALIFIED côté kanban.
-- On ajoute donc crmStage qui stocke directement la valeur du stage kanban.
-- =============================================================

-- Ajout des colonnes (idempotent grâce à IF NOT EXISTS)
ALTER TABLE "MissionRequest" ADD COLUMN IF NOT EXISTS "crmStage" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "Offer"          ADD COLUMN IF NOT EXISTS "crmStage" TEXT NOT NULL DEFAULT 'NEW';
ALTER TABLE "Project"        ADD COLUMN IF NOT EXISTS "crmStage" TEXT NOT NULL DEFAULT 'WON';

-- Backfill MissionRequest depuis status existant (best effort)
UPDATE "MissionRequest" SET "crmStage" = CASE
  WHEN status = 'NEW'        THEN 'NEW'
  WHEN status = 'QUALIFYING' THEN 'QUALIFIED'
  WHEN status = 'PRESENTING' THEN 'PROPOSED'
  WHEN status = 'CONTRACTED' THEN 'WON'
  WHEN status = 'LOST'       THEN 'LOST'
  WHEN status = 'CANCELLED'  THEN 'CANCELLED'
  ELSE 'NEW'
END
WHERE "crmStage" = 'NEW'; -- seulement les valeurs par défaut, ne touche pas aux éventuels updates manuels

-- Backfill Offer depuis status existant
UPDATE "Offer" SET "crmStage" = CASE
  WHEN status = 'DRAFT'       THEN 'NEW'
  WHEN status = 'SENT'        THEN 'PROPOSED'
  WHEN status = 'NEGOTIATION' THEN 'NEGOTIATING'
  WHEN status = 'WON'         THEN 'WON'
  WHEN status = 'LOST'        THEN 'LOST'
  WHEN status = 'CANCELLED'   THEN 'CANCELLED'
  ELSE 'NEW'
END
WHERE "crmStage" = 'NEW';

-- Backfill Project : seul CANCELLED se distingue de WON
UPDATE "Project" SET "crmStage" = CASE
  WHEN status = 'CANCELLED' THEN 'CANCELLED'
  ELSE 'WON'
END
WHERE "crmStage" = 'WON';
