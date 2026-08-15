CREATE TABLE "todo_events" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"title" text NOT NULL,
	"expected_on" date,
	"happened_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"parent_id" varchar(52),
	"kind" varchar(16) NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"planned_on" date,
	"waits_for_event_id" varchar(52),
	"waits_until" date,
	"badge" varchar(64),
	"archived_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "todo_events" ADD CONSTRAINT "todo_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_parent_id_todos_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."todos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todo_events_account_idx" ON "todo_events" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "todos_account_kind_idx" ON "todos" USING btree ("account_id","kind");--> statement-breakpoint
CREATE INDEX "todos_parent_idx" ON "todos" USING btree ("parent_id");