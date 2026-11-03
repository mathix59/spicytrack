CREATE TABLE "issue_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"tracker_id" uuid,
	"provider" varchar(16) NOT NULL,
	"external_key" varchar(128) NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_trackers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" varchar(16) NOT NULL,
	"name" varchar(80) NOT NULL,
	"config" jsonb NOT NULL,
	"token_ciphertext" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_tickets" ADD CONSTRAINT "issue_tickets_tracker_id_ticket_trackers_id_fk" FOREIGN KEY ("tracker_id") REFERENCES "public"."ticket_trackers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_tickets_issue_idx" ON "issue_tickets" USING btree ("issue_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_trackers_project_name_idx" ON "ticket_trackers" USING btree ("project_id","name");