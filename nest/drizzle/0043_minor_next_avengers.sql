CREATE TABLE "roles" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"title" varchar(64) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_roles" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"role_id" varchar(52) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_code_lower_unique" ON "roles" USING btree (lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "account_roles_account_role_unique" ON "account_roles" USING btree ("account_id","role_id");--> statement-breakpoint
CREATE INDEX "account_roles_role_idx" ON "account_roles" USING btree ("role_id");