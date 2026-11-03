DROP INDEX "autofix_runs_in_flight_issue_idx";--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "phase" varchar(16) DEFAULT 'fix' NOT NULL;--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "fix_requested_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "analysis" jsonb;--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "commit_sha" varchar(64);--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "checks_status" varchar(16);--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "checks_summary" jsonb;--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "checks_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "autofix_runs" ADD COLUMN "checks_deadline_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_ai_settings" ADD COLUMN "monthly_budget_micros" bigint;--> statement-breakpoint
ALTER TABLE "organization_ai_settings" ADD COLUMN "run_cost_cap_micros" bigint;--> statement-breakpoint
ALTER TABLE "project_autofix_configs" ADD COLUMN "auto_fix_after_analysis" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_autofix_configs" ADD COLUMN "require_passing_checks" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "autofix_runs_in_flight_issue_idx" ON "autofix_runs" USING btree ("issue_id") WHERE "autofix_runs"."status" in ('queued', 'running', 'checking');