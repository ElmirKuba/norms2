CREATE TABLE "goals" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"parent_goal_id" varchar(52),
	"title" text NOT NULL,
	"why_it_matters" text,
	"domain_key" varchar(64),
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"direction" varchar(16) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"target_value" double precision NOT NULL,
	"start_value" double precision,
	"deadline" date,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"fallback_version" text,
	"paused_at" timestamp with time zone,
	"pause_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_target_value_nonzero" CHECK ("goals"."target_value" <> 0)
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_goals_id_fk" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;