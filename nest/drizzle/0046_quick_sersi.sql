ALTER TABLE "notifications" DROP CONSTRAINT "notifications_content_format_check";--> statement-breakpoint
DROP INDEX "notifications_key_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_release_broadcast_unique" ON "notifications" USING btree ("release_id") WHERE "notifications"."account_id" is null;--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "content_file";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "content_format";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "broadcasted_at";--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "published_at";