CREATE INDEX "alert_deliveries_project_created_idx" ON "alert_deliveries" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_created_idx" ON "audit_logs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "events_project_environment_issue_idx" ON "events" USING btree ("project_id","environment_id","issue_id");--> statement-breakpoint
CREATE INDEX "events_project_release_issue_idx" ON "events" USING btree ("project_id","release_id","issue_id");--> statement-breakpoint
CREATE INDEX "events_project_ingested_idx" ON "events" USING btree ("project_id","ingested_at");--> statement-breakpoint
CREATE INDEX "events_merged_from_idx" ON "events" USING btree ("merged_from_issue_id") WHERE "events"."merged_from_issue_id" is not null;--> statement-breakpoint
CREATE INDEX "issue_activity_issue_created_idx" ON "issue_activity" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_comments_issue_created_idx" ON "issue_comments" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issues_project_grouping_key_idx" ON "issues" USING btree ("project_id","grouping_key");--> statement-breakpoint
CREATE INDEX "issues_project_last_seen_idx" ON "issues" USING btree ("project_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "issues_project_status_last_seen_idx" ON "issues" USING btree ("project_id","status","last_seen_at");--> statement-breakpoint
CREATE INDEX "issues_merged_into_idx" ON "issues" USING btree ("merged_into_issue_id") WHERE "issues"."merged_into_issue_id" is not null;