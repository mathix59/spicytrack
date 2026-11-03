CREATE TABLE "alert_issue_cooldowns" (
	"alert_rule_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"last_triggered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "alert_issue_cooldowns_alert_rule_id_issue_id_pk" PRIMARY KEY("alert_rule_id","issue_id")
);
--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "threshold_window_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD COLUMN "last_digest_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "merged_from_issue_id" uuid;--> statement-breakpoint
UPDATE "alert_rules" SET "cooldown_minutes" = 10080 WHERE "cooldown_minutes" > 10080;--> statement-breakpoint
UPDATE "autofix_runs" SET "status" = 'failed', "error" = 'Superseded by a newer run for the same issue', "finished_at" = now()
WHERE "status" IN ('queued', 'running') AND "id" NOT IN (
	SELECT DISTINCT ON ("issue_id") "id" FROM "autofix_runs"
	WHERE "status" IN ('queued', 'running')
	ORDER BY "issue_id", "created_at" DESC
);--> statement-breakpoint
CREATE UNIQUE INDEX "autofix_runs_in_flight_issue_idx" ON "autofix_runs" USING btree ("issue_id") WHERE "autofix_runs"."status" in ('queued', 'running');