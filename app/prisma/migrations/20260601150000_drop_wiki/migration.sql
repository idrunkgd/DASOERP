-- =============================================================
-- DROP WIKI : on retire le module Wiki, finalement non utilisé.
-- Idempotent : si la table n'a jamais été créée en prod, ne fait rien.
-- =============================================================

DROP TABLE IF EXISTS "WikiPage" CASCADE;
