CREATE TABLE "session_token_history" (
	"id" varchar(52) PRIMARY KEY NOT NULL,
	"session_id" varchar(52) NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session_token_history" ADD CONSTRAINT "session_token_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_history_token_hash_unique" ON "session_token_history" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_token_history_session_id_idx" ON "session_token_history" USING btree ("session_id");