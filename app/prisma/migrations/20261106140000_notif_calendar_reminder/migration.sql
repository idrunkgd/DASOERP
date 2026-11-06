-- Ajoute le type CALENDAR_REMINDER à l'enum NotificationType.
-- PostgreSQL : ALTER TYPE ... ADD VALUE est IMMUTABLE en transaction, donc
-- on utilise IF NOT EXISTS pour que la migration soit idempotente.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CALENDAR_REMINDER';
