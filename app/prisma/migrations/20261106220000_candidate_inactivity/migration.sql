-- Nouveau type de notification : candidat inactif depuis >4 mois.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CANDIDATE_INACTIVE';

-- Stockage du dernier rappel envoyé (anti-spam).
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "lastInactivityReminderAt" TIMESTAMP(3);
