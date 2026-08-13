ALTER TABLE "account_roles" DROP CONSTRAINT "account_roles_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "session_token_history" DROP CONSTRAINT "session_token_history_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_release_id_releases_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_reads" DROP CONSTRAINT "notification_reads_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_reads" DROP CONSTRAINT "notification_reads_notification_id_notifications_id_fk";
--> statement-breakpoint
ALTER TABLE "accent_settings" DROP CONSTRAINT "accent_settings_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "micro_wins" DROP CONSTRAINT "micro_wins_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "micro_win_logs" DROP CONSTRAINT "micro_win_logs_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "micro_win_logs" DROP CONSTRAINT "micro_win_logs_micro_win_id_micro_wins_id_fk";
--> statement-breakpoint
ALTER TABLE "habits" DROP CONSTRAINT "habits_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_template_id_habits_id_fk";
--> statement-breakpoint
ALTER TABLE "goals" DROP CONSTRAINT "goals_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "goals" DROP CONSTRAINT "goals_parent_goal_id_goals_id_fk";
--> statement-breakpoint
ALTER TABLE "goal_entries" DROP CONSTRAINT "goal_entries_goal_id_goals_id_fk";
--> statement-breakpoint
ALTER TABLE "milestones" DROP CONSTRAINT "milestones_goal_id_goals_id_fk";
--> statement-breakpoint
ALTER TABLE "anti_habits" DROP CONSTRAINT "anti_habits_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "anti_habit_events" DROP CONSTRAINT "anti_habit_events_anti_habit_id_anti_habits_id_fk";
--> statement-breakpoint
ALTER TABLE "obstacles" DROP CONSTRAINT "obstacles_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "counterplays" DROP CONSTRAINT "counterplays_obstacle_id_obstacles_id_fk";
--> statement-breakpoint
ALTER TABLE "obstacle_encounters" DROP CONSTRAINT "obstacle_encounters_obstacle_id_obstacles_id_fk";
--> statement-breakpoint
ALTER TABLE "user_achievements" DROP CONSTRAINT "user_achievements_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "telegram_requests" DROP CONSTRAINT "telegram_requests_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "telegram_links" DROP CONSTRAINT "telegram_links_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_token_history" ADD CONSTRAINT "session_token_history_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accent_settings" ADD CONSTRAINT "accent_settings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_wins" ADD CONSTRAINT "micro_wins_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_win_logs" ADD CONSTRAINT "micro_win_logs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "micro_win_logs" ADD CONSTRAINT "micro_win_logs_micro_win_id_micro_wins_id_fk" FOREIGN KEY ("micro_win_id") REFERENCES "public"."micro_wins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_template_id_habits_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."habits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_goals_id_fk" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_entries" ADD CONSTRAINT "goal_entries_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anti_habits" ADD CONSTRAINT "anti_habits_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "anti_habit_events" ADD CONSTRAINT "anti_habit_events_anti_habit_id_anti_habits_id_fk" FOREIGN KEY ("anti_habit_id") REFERENCES "public"."anti_habits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obstacles" ADD CONSTRAINT "obstacles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterplays" ADD CONSTRAINT "counterplays_obstacle_id_obstacles_id_fk" FOREIGN KEY ("obstacle_id") REFERENCES "public"."obstacles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obstacle_encounters" ADD CONSTRAINT "obstacle_encounters_obstacle_id_obstacles_id_fk" FOREIGN KEY ("obstacle_id") REFERENCES "public"."obstacles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_requests" ADD CONSTRAINT "telegram_requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;