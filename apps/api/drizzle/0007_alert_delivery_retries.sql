ALTER TABLE "alert_deliveries" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD COLUMN "last_attempt_at" timestamp with time zone;--> statement-breakpoint
UPDATE "alert_deliveries" SET "attempts" = 1, "last_attempt_at" = "created_at";
