CREATE TABLE "anti_habit_events" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"anti_habit_id" varchar(52) NOT NULL,
	"type" varchar(16) NOT NULL,
	"occurred_at" bigint NOT NULL,
	"attempt_duration_ms" bigint,
	"ended_attempt_number" integer,
	"trigger_tag" varchar(120),
	"note" text,
	"from_started_at" bigint,
	"to_started_at" bigint,
	"held_days" integer,
	"threshold_label" varchar(32),
	"threshold_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anti_habit_events" ADD CONSTRAINT "anti_habit_events_anti_habit_id_anti_habits_id_fk" FOREIGN KEY ("anti_habit_id") REFERENCES "public"."anti_habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anti_habit_events_habit_at_idx" ON "anti_habit_events" USING btree ("anti_habit_id","occurred_at");