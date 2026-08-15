ALTER TABLE "tasks" RENAME TO "habit_tasks";--> statement-breakpoint
ALTER TABLE "habit_tasks" DROP CONSTRAINT "tasks_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "habit_tasks" DROP CONSTRAINT "tasks_template_id_habits_id_fk";
--> statement-breakpoint
DROP INDEX "tasks_template_day_unique";--> statement-breakpoint
ALTER TABLE "habit_tasks" ADD CONSTRAINT "habit_tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_tasks" ADD CONSTRAINT "habit_tasks_template_id_habits_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."habits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "habit_tasks_template_day_unique" ON "habit_tasks" USING btree ("template_id","occurred_on");