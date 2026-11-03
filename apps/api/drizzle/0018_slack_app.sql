CREATE TABLE "organization_slack_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" varchar(32) NOT NULL,
	"team_name" varchar(255),
	"signing_secret_ciphertext" text NOT NULL,
	"bot_token_ciphertext" text NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "org_slack_settings_org_idx" ON "organization_slack_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_slack_settings_team_idx" ON "organization_slack_settings" USING btree ("team_id");