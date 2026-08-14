-- Третий тип заявки: просьба снять бан (2.9.3·22).
--
-- Снять бан вправе банивший или его предок по ветке, но оба могли удалить аккаунт или просто
-- молчать — и тогда у забаненного не оставалось ни одного пути: он видел «вы забанены» и упирался
-- в тупик. Заявка боту — вход в ту же приёмную, где уже разбираются вступление и приглашения.
ALTER TABLE "telegram_requests" DROP CONSTRAINT IF EXISTS "telegram_requests_type_check";--> statement-breakpoint
ALTER TABLE "telegram_requests" ADD CONSTRAINT "telegram_requests_type_check" CHECK ("telegram_requests"."type" in ('join', 'more_invites', 'unban'));
--> statement-breakpoint
-- Заявка на разбан, как и просьба о приглашениях, без аккаунта бессмысленна.
ALTER TABLE "telegram_requests" DROP CONSTRAINT IF EXISTS "telegram_requests_account_by_type_check";--> statement-breakpoint
ALTER TABLE "telegram_requests" ADD CONSTRAINT "telegram_requests_account_by_type_check" CHECK (("telegram_requests"."type" in ('more_invites', 'unban') and "telegram_requests"."account_id" is not null) or ("telegram_requests"."type" = 'join' and "telegram_requests"."account_id" is null));
