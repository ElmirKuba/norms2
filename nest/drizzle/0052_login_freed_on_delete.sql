-- Логин освобождается при удалении аккаунта (2.9.3·29.1, реш. Elmir 14.08.2026).
--
-- Уникальность по `lower(login)` считалась по ВСЕМ строкам, включая мягко удалённые. Это делало
-- paranoid половинчатым: для бизнес-логики удалённого аккаунта нет, а занять его логин было
-- нельзя — и человеку пришлось бы объяснять, почему «занято» то, чего не существует.
DROP INDEX IF EXISTS "accounts_login_lower_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_login_lower_unique" ON "accounts" (lower("login")) WHERE "deleted_at" IS NULL;
