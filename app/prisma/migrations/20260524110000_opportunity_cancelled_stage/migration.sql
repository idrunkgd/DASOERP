-- Ajout de la valeur CANCELLED à l'enum OpportunityStage.
ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'CANCELLED';
