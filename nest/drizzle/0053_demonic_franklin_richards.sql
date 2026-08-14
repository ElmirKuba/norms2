ALTER TABLE "telegram_requests" DROP CONSTRAINT "telegram_requests_type_check";--> statement-breakpoint
ALTER TABLE "telegram_requests" DROP CONSTRAINT "telegram_requests_account_by_type_check";--> statement-breakpoint
DROP INDEX "accounts_login_lower_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_login_lower_unique" ON "accounts" USING btree (lower("login")) WHERE deleted_at is null;--> statement-breakpoint
ALTER TABLE "telegram_requests" ADD CONSTRAINT "telegram_requests_type_check" CHECK ("telegram_requests"."type" in ('join', 'more_invites', 'unban'));--> statement-breakpoint
ALTER TABLE "telegram_requests" ADD CONSTRAINT "telegram_requests_account_by_type_check" CHECK (("telegram_requests"."type" in ('more_invites', 'unban') and "telegram_requests"."account_id" is not null)
          or ("telegram_requests"."type" = 'join' and "telegram_requests"."account_id" is null));