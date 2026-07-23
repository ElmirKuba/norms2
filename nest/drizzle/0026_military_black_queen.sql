CREATE TABLE "anti_habits" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"current_attempt_started_at" bigint NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"record_days" integer DEFAULT 0 NOT NULL,
	"record_attempt_started_at" bigint,
	"target_days" integer,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "anti_habits_attempt_number_min" CHECK ("anti_habits"."attempt_number" >= 1),
	CONSTRAINT "anti_habits_record_days_min" CHECK ("anti_habits"."record_days" >= 0),
	CONSTRAINT "anti_habits_target_days_positive" CHECK ("anti_habits"."target_days" IS NULL OR "anti_habits"."target_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "anti_habit_relapses" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"anti_habit_id" varchar(52) NOT NULL,
	"relapse_at" bigint NOT NULL,
	"attempt_duration_ms" bigint NOT NULL,
	"trigger_tag" varchar(120),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anti_habits" ADD CONSTRAINT "anti_habits_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anti_habit_relapses" ADD CONSTRAINT "anti_habit_relapses_anti_habit_id_anti_habits_id_fk" FOREIGN KEY ("anti_habit_id") REFERENCES "public"."anti_habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "anti_habit_relapses_habit_at_idx" ON "anti_habit_relapses" USING btree ("anti_habit_id","relapse_at");