CREATE TABLE "release_commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"sha" varchar(64) NOT NULL,
	"message" text NOT NULL,
	"author_name" text,
	"author_email" text,
	"author_login" text,
	"committed_at" timestamp with time zone,
	"url" text,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"files_truncated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "commit_sha" varchar(64);--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "commits_status" varchar(16);--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "commits_error" text;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "commits_base_sha" varchar(64);--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "commits_truncated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "commits_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "release_commits" ADD CONSTRAINT "release_commits_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_commits_release_sha_idx" ON "release_commits" USING btree ("release_id","sha");