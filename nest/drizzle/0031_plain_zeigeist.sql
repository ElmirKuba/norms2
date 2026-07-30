CREATE TABLE "obstacles" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"name" text NOT NULL,
	"type" varchar(20) NOT NULL,
	"domain_key" varchar(64),
	"trigger" text,
	"symptoms" text,
	"intensity" integer DEFAULT 3 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_starter" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "obstacles_intensity_range" CHECK ("obstacles"."intensity" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "counterplays" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"obstacle_id" varchar(52) NOT NULL,
	"text" text NOT NULL,
	"linked_micro_win_id" varchar(52),
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obstacle_encounters" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"obstacle_id" varchar(52) NOT NULL,
	"occurred_at" bigint NOT NULL,
	"counterplay_id" varchar(52),
	"outcome" varchar(8),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anti_habit_events" ADD COLUMN "obstacle_id" varchar(52);--> statement-breakpoint
ALTER TABLE "obstacles" ADD CONSTRAINT "obstacles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterplays" ADD CONSTRAINT "counterplays_obstacle_id_obstacles_id_fk" FOREIGN KEY ("obstacle_id") REFERENCES "public"."obstacles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterplays" ADD CONSTRAINT "counterplays_linked_micro_win_id_micro_wins_id_fk" FOREIGN KEY ("linked_micro_win_id") REFERENCES "public"."micro_wins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obstacle_encounters" ADD CONSTRAINT "obstacle_encounters_obstacle_id_obstacles_id_fk" FOREIGN KEY ("obstacle_id") REFERENCES "public"."obstacles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obstacle_encounters" ADD CONSTRAINT "obstacle_encounters_counterplay_id_counterplays_id_fk" FOREIGN KEY ("counterplay_id") REFERENCES "public"."counterplays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "obstacles_account_position_idx" ON "obstacles" USING btree ("account_id","position");--> statement-breakpoint
CREATE INDEX "counterplays_obstacle_position_idx" ON "counterplays" USING btree ("obstacle_id","position");--> statement-breakpoint
CREATE INDEX "obstacle_encounters_obstacle_at_idx" ON "obstacle_encounters" USING btree ("obstacle_id","occurred_at");--> statement-breakpoint
ALTER TABLE "anti_habit_events" ADD CONSTRAINT "anti_habit_events_obstacle_id_obstacles_id_fk" FOREIGN KEY ("obstacle_id") REFERENCES "public"."obstacles"("id") ON DELETE set null ON UPDATE no action;