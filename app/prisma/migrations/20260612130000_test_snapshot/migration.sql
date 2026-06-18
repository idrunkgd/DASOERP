-- Snapshot des questions au moment du démarrage du test.
-- Permet d'afficher les bonnes réponses telles qu'à l'époque même si
-- l'admin a édité les questions du test depuis.
ALTER TABLE "TestSubmission" ADD COLUMN "questionsSnapshot" JSONB;
