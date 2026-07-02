-- MissionProposal → refonte : pivot sur MissionApplication au lieu d'un lien
-- direct au candidat. Une proposition = une offre PDF générée sur un profil
-- présenté (candidate OU consultant interne, la logique polymorphique est
-- déjà dans MissionApplication).
--
-- Le champ candidateId devient redondant (on remonte via application.candidateId
-- ou application.consultantId). On le supprime après backfill.

-- ─── 1. Add applicationId (nullable pour backfill) ───
ALTER TABLE "MissionProposal" ADD COLUMN "applicationId" TEXT;

-- ─── 2. Backfill : pour chaque proposal existante sans application, on crée
--     l'application correspondante (si elle n'existe pas déjà pour ce couple
--     mission-request / candidat). Puis on rattache le lien.
--     ON CONFLICT DO NOTHING pour respecter l'unique (missionRequestId, candidateId).
INSERT INTO "MissionApplication"
    ("id", "missionRequestId", "candidateId", "status", "proposedDailyRate", "presentedAt", "createdAt", "updatedAt")
SELECT
    'appL_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20),
    p."missionRequestId",
    p."candidateId",
    'OFFER_SENT'::"ApplicationStatus",
    p."dailyRate",
    p."createdAt",
    p."createdAt",
    p."updatedAt"
FROM "MissionProposal" p
WHERE p."candidateId" IS NOT NULL
ON CONFLICT ("missionRequestId", "candidateId") DO NOTHING;

-- ─── 3. Rattacher chaque proposal à l'application correspondante (créée
--     à l'étape précédente OU pré-existante).
UPDATE "MissionProposal" p
SET "applicationId" = a."id"
FROM "MissionApplication" a
WHERE p."applicationId" IS NULL
  AND a."missionRequestId" = p."missionRequestId"
  AND a."candidateId"      = p."candidateId";

-- ─── 4. Marquer les applications concernées en OFFER_SENT si elles étaient
--     encore PRESENTED (l'existence d'une proposition = offre envoyée).
UPDATE "MissionApplication" a
SET "status" = 'OFFER_SENT'::"ApplicationStatus"
FROM "MissionProposal" p
WHERE p."applicationId" = a."id"
  AND a."status" = 'PRESENTED'::"ApplicationStatus";

-- ─── 5. Contraintes : applicationId devient NOT NULL + unique + FK.
--     Une application ne peut avoir qu'une seule proposition ; si on veut
--     renvoyer une nouvelle offre (dates modifiées), on écrase l'ancienne.
ALTER TABLE "MissionProposal" ALTER COLUMN "applicationId" SET NOT NULL;
CREATE UNIQUE INDEX "MissionProposal_applicationId_key" ON "MissionProposal"("applicationId");
ALTER TABLE "MissionProposal" ADD CONSTRAINT "MissionProposal_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "MissionApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 6. Suppression de candidateId (accès désormais via application).
ALTER TABLE "MissionProposal" DROP CONSTRAINT IF EXISTS "MissionProposal_candidateId_fkey";
DROP INDEX IF EXISTS "MissionProposal_candidateId_idx";
ALTER TABLE "MissionProposal" DROP COLUMN "candidateId";
