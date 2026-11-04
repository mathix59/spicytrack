CREATE TABLE "release_health_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"environment" varchar(128) DEFAULT '' NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"errored" integer DEFAULT 0 NOT NULL,
	"abnormal" integer DEFAULT 0 NOT NULL,
	"crashed" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_health_sessions" (
	"project_id" uuid NOT NULL,
	"session_id" varchar(64) NOT NULL,
	"bucket_id" uuid NOT NULL,
	"outcome" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "release_health_sessions_project_id_session_id_pk" PRIMARY KEY("project_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "release_health_users" (
	"project_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"environment" varchar(128) DEFAULT '' NOT NULL,
	"day" date NOT NULL,
	"user_hash" varchar(64) NOT NULL,
	"crashed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "release_health_users_project_id_release_id_environment_day_user_hash_pk" PRIMARY KEY("project_id","release_id","environment","day","user_hash")
);
--> statement-breakpoint
ALTER TABLE "release_health_buckets" ADD CONSTRAINT "release_health_buckets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_health_sessions" ADD CONSTRAINT "release_health_sessions_bucket_id_release_health_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "release_health_buckets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_health_users" ADD CONSTRAINT "release_health_users_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "release_health_buckets_key_idx" ON "release_health_buckets" USING btree ("project_id","release_id","environment","bucket_start");--> statement-breakpoint
CREATE INDEX "release_health_buckets_project_time_idx" ON "release_health_buckets" USING btree ("project_id","bucket_start");--> statement-breakpoint
CREATE INDEX "release_health_sessions_updated_idx" ON "release_health_sessions" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "release_health_users_project_day_idx" ON "release_health_users" USING btree ("project_id","day");