-- Refonte flux mission-request : le pipeline est désormais 100% piloté par
-- ApplicationStatus. On supprime MissionProposal.status pour éviter d'avoir
-- deux sources de vérité sur le même état métier.
--
-- Le champ sentAt reste (marqueur d'envoi client), decidedAt reste (marqueur
-- de décision), lostReason reste (raison de refus). L'enum MissionProposalStatus
-- est conservé au cas où on voudrait le réintroduire, mais plus référencé.

ALTER TABLE "MissionProposal" DROP COLUMN "status";
