-- =============================================================
-- Nouveau statut INVOICED pour BillingMilestoneStatus
-- = facture émise et envoyée au client, mais pas encore payée.
-- Utilisé pour le KPI cashflow "En cours" (outstanding receivables).
-- =============================================================

ALTER TYPE "BillingMilestoneStatus" ADD VALUE IF NOT EXISTS 'INVOICED' BEFORE 'TRANSMITTED';
