CREATE TABLE "telegram_requests" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"chat_id" varchar(32) NOT NULL,
	"type" varchar(16) NOT NULL,
	"status" varchar(16) NOT NULL,
	"account_id" varchar(52),
	"invite_code_id" varchar(52),
	"owner_message_id" integer,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_requests_type_check" CHECK ("telegram_requests"."type" in ('join', 'more_invites')),
	CONSTRAINT "telegram_requests_status_check" CHECK ("telegram_requests"."status" in ('pending', 'approved', 'rejected', 'expired')),
	CONSTRAINT "telegram_requests_account_by_type_check" CHECK (("telegram_requests"."type" = 'more_invites' and "telegram_requests"."account_id" is not null)
          or ("telegram_requests"."type" = 'join' and "telegram_requests"."account_id" is null))
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"account_id" varchar(52) NOT NULL,
	"chat_id" varchar(32) NOT NULL,
	"notifications_allowed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_requests" ADD CONSTRAINT "telegram_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_requests" ADD CONSTRAINT "telegram_requests_invite_code_id_invite_codes_id_fk" FOREIGN KEY ("invite_code_id") REFERENCES "public"."invite_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_requests_status_created_at_idx" ON "telegram_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "telegram_requests_chat_id_idx" ON "telegram_requests" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_requests_one_pending_per_chat" ON "telegram_requests" USING btree ("chat_id") WHERE status = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_account_id_unique" ON "telegram_links" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_chat_id_unique" ON "telegram_links" USING btree ("chat_id");