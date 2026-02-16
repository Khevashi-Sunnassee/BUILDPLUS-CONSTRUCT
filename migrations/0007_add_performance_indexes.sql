-- Performance indexes for user_id columns on tables missing them
CREATE INDEX IF NOT EXISTS "idx_budget_line_updates_user_id" ON "budget_line_updates" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_help_feedback_user_id" ON "help_feedback" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tender_member_updates_user_id" ON "tender_member_updates" ("user_id");--> statement-breakpoint

-- Performance indexes for created_at on high-volume tables
CREATE INDEX IF NOT EXISTS "idx_help_entries_created_at" ON "help_entries" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_claim_items_created_at" ON "progress_claim_items" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_task_groups_created_at" ON "task_groups" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scope_items_created_at" ON "scope_items" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_checklist_templates_created_at" ON "checklist_templates" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_suppliers_created_at" ON "suppliers" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tender_members_created_at" ON "tender_members" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_progress_claims_created_at" ON "progress_claims" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_jobs_created_at" ON "jobs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_status_history_created_at" ON "sales_status_history" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tender_scopes_created_at" ON "tender_scopes" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_tenders_created_at" ON "tenders" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_scopes_created_at" ON "scopes" ("created_at");
