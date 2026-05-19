-- Ajoute SIMULATION_INCOME à l'enum CashflowKind pour permettre des
-- recettes simulées (ex. consultant en mission hypothétique). Idempotent.
ALTER TYPE "CashflowKind" ADD VALUE IF NOT EXISTS 'SIMULATION_INCOME';
