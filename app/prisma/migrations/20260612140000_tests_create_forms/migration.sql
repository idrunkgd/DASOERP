-- Création libre de tests : on retire l'unicité sur Test.domain pour pouvoir
-- en créer plusieurs par domaine (ex. plusieurs tests PLC ciblant des
-- niveaux de séniorité différents). On ajoute aussi la valeur OTHER pour
-- les tests qui ne correspondent à aucun des 5 domaines initiaux.

DROP INDEX IF EXISTS "Test_domain_key";

ALTER TYPE "TestDomain" ADD VALUE IF NOT EXISTS 'OTHER';
