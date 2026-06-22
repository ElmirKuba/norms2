CREATE TABLE "goal_entries" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"goal_id" varchar(52) NOT NULL,
	"value" double precision NOT NULL,
	"occurred_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goal_entries" ADD CONSTRAINT "goal_entries_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goal_entries_goal_occurred_idx" ON "goal_entries" USING btree ("goal_id","occurred_on");