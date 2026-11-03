ALTER TABLE "audit_logs" ALTER COLUMN "organization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "actor_token_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "ip_address" varchar(64);--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "user_agent" varchar(512);--> statement-breakpoint
CREATE INDEX "audit_logs_instance_created_idx" ON "audit_logs" USING btree ("created_at") WHERE "audit_logs"."organization_id" IS NULL;