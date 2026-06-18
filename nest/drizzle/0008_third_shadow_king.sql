CREATE TABLE "habits" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"icon" varchar(32),
	"domain_key" varchar(64),
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"goal_id" varchar(52),
	"priority" integer DEFAULT 0 NOT NULL,
	"kind" varchar(16) NOT NULL,
	"recurrence" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"ladder" jsonb NOT NULL,
	"min_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;