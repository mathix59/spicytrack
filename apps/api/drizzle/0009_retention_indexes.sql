CREATE INDEX "alert_deliveries_created_idx" ON "alert_deliveries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");