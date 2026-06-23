CREATE TABLE "milestones" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"goal_id" varchar(52) NOT NULL,
	"title" text NOT NULL,
	"threshold_value" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestones_goal_idx" ON "milestones" USING btree ("goal_id");