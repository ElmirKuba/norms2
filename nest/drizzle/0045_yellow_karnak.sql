CREATE TABLE "admin_audit_log" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"actor_account_id" varchar(52),
	"actor_login" varchar(64),
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" varchar(128),
	"target_label" varchar(128),
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_account_id_accounts_id_fk" FOREIGN KEY ("actor_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_actor_idx" ON "admin_audit_log" USING btree ("actor_account_id");