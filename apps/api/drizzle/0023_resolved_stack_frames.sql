CREATE TABLE "resolved_stack_frames" (
	"release_id" uuid NOT NULL,
	"artifacts_fingerprint" varchar(32) NOT NULL,
	"frame_key" varchar(32) NOT NULL,
	"frame" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resolved_stack_frames_release_id_artifacts_fingerprint_frame_key_pk" PRIMARY KEY("release_id","artifacts_fingerprint","frame_key")
);
--> statement-breakpoint
ALTER TABLE "resolved_stack_frames" ADD CONSTRAINT "resolved_stack_frames_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;