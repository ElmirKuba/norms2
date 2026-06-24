ALTER TABLE "micro_wins" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "micro_wins" m SET "position" = sub.rn FROM (
  SELECT id, (row_number() OVER (PARTITION BY account_id ORDER BY created_at) - 1)::int AS rn
  FROM "micro_wins"
) sub WHERE m.id = sub.id;