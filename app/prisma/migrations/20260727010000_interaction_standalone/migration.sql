-- ContactInteraction : contactId devient nullable pour permettre les
-- tâches génériques (non liées à un contact précis). Ex : "commander
-- cartes de visite", "renouveler abonnement Notion", etc.
ALTER TABLE "ContactInteraction" ALTER COLUMN "contactId" DROP NOT NULL;
