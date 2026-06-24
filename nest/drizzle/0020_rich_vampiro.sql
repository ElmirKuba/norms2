ALTER TABLE "goals" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE "goals" g SET "position" = sub.rn FROM (
  SELECT id, (row_number() OVER (PARTITION BY account_id ORDER BY created_at) - 1)::int AS rn
  FROM "goals"
) sub WHERE g.id = sub.id;
