CREATE TABLE "micro_wins" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"title" text NOT NULL,
	"category" varchar(16) NOT NULL,
	"duration_seconds" integer NOT NULL,
	"energy_cost" integer NOT NULL,
	"effect" text,
	"disabled_for_states" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "micro_wins_energy_cost_range" CHECK ("micro_wins"."energy_cost" BETWEEN 1 AND 3),
	CONSTRAINT "micro_wins_duration_range" CHECK ("micro_wins"."duration_seconds" BETWEEN 0 AND 300)
);
--> statement-breakpoint
CREATE TABLE "micro_win_logs" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"micro_win_id" varchar(52) NOT NULL,
	"occurred_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "micro_wins" ADD CONSTRAINT "micro_wins_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_win_logs" ADD CONSTRAINT "micro_win_logs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_win_logs" ADD CONSTRAINT "micro_win_logs_micro_win_id_micro_wins_id_fk" FOREIGN KEY ("micro_win_id") REFERENCES "public"."micro_wins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "micro_win_logs_win_day_unique" ON "micro_win_logs" USING btree ("micro_win_id","occurred_on");