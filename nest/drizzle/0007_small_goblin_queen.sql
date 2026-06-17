ALTER TABLE "micro_wins" ADD COLUMN "is_starter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accent_settings" DROP COLUMN "starter_micro_wins_seeded_at";