-- Ajout d'un champ dailyRate (taux journalier facturable au client) distinct
-- du dailyCost (coût interne) sur Candidate et User. Affiché sur le CV et
-- utilisé comme suggestion par défaut lors de la présentation d'un profil
-- sur une demande de mission.

ALTER TABLE "Candidate" ADD COLUMN "dailyRate" DECIMAL(10, 2);
ALTER TABLE "User"      ADD COLUMN "dailyRate" DECIMAL(10, 2);
