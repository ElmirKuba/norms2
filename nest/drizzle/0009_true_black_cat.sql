CREATE TABLE "tasks" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"template_id" varchar(52),
	"goal_id" varchar(52),
	"title" text NOT NULL,
	"occurred_on" date NOT NULL,
	"kind" varchar(16) NOT NULL,
	"target_value" integer,
	"done_value" integer,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"skip_reason" varchar(16),
	"postponed_from_task_id" varchar(52),
	"priority" integer DEFAULT 0 NOT NULL,
	"category" varchar(32),
	"deadline" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_id_habits_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_template_day_unique" ON "tasks" USING btree ("template_id","occurred_on");