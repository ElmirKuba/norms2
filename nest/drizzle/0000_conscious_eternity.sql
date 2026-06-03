CREATE TABLE "accounts" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"login" varchar(32) NOT NULL,
	"alias" varchar(32) NOT NULL,
	"avatar" varchar,
	"password_hash" text NOT NULL,
	"registration_source" varchar(8) NOT NULL,
	"invites_remaining" integer DEFAULT 3 NOT NULL,
	"recovery_required_count" integer,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"deactivated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"version" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_registration_source_check" CHECK ("accounts"."registration_source" in ('free', 'invite', 'seed'))
);
--> statement-breakpoint
CREATE TABLE "secret_qa" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"question" text NOT NULL,
	"answer_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"code" varchar(10) NOT NULL,
	"inviter_id" varchar(52) NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"inviter_id" varchar(52) NOT NULL,
	"reason" text NOT NULL,
	"invited_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bans" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"banner_id" varchar(52) NOT NULL,
	"target_id" varchar(52) NOT NULL,
	"reason" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "secret_qa" ADD CONSTRAINT "secret_qa_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_inviter_id_accounts_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_accounts_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_banner_id_accounts_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bans" ADD CONSTRAINT "bans_target_id_accounts_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_login_lower_unique" ON "accounts" USING btree (lower("login"));--> statement-breakpoint
CREATE INDEX "secret_qa_account_id_idx" ON "secret_qa" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invite_codes_code_unique" ON "invite_codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invite_codes_inviter_id_idx" ON "invite_codes" USING btree ("inviter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_account_id_unique" ON "invitations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "invitations_inviter_id_idx" ON "invitations" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "bans_target_active_idx" ON "bans" USING btree ("target_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "bans_banner_target_active_unique" ON "bans" USING btree ("banner_id","target_id") WHERE "bans"."active";--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");