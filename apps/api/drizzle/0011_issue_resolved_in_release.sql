ALTER TABLE "issues" ADD COLUMN "resolved_in_release_id" uuid;--> statement-breakpoint
-- Issues resolved before this migration only reopened on an event from another release: keep that.
UPDATE "issues" SET "resolved_in_release_id" = "release_id" WHERE "status" = 'resolved' AND "release_id" IS NOT NULL;
