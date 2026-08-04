CREATE TABLE "user_achievements" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"code" varchar(32) NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"context" varchar(120)
);
--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_account_code_unique" ON "user_achievements" USING btree ("account_id","code");