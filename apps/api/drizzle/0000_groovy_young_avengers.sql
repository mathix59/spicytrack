CREATE TABLE "ai_model_pricing_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_version_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(255) NOT NULL,
	"currency" varchar(8) DEFAULT 'USD' NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"rates_per_million" jsonb NOT NULL,
	"pricing_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_pricing_catalog_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"source_revision" varchar(255),
	"etag" varchar(255),
	"schema_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"issue_id" uuid,
	"operation" varchar(32) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(255),
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cache_read_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"usage_dimensions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pricing_rule_id" uuid,
	"pricing_snapshot" jsonb,
	"billing_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"estimated_cost_micros" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"alert_rule_id" uuid NOT NULL,
	"issue_id" uuid,
	"event_id" uuid,
	"status" varchar(32) NOT NULL,
	"response_status" integer,
	"response_body" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"trigger_type" varchar(64) NOT NULL,
	"threshold" integer,
	"cooldown_minutes" integer DEFAULT 30 NOT NULL,
	"destination_type" varchar(32) DEFAULT 'webhook' NOT NULL,
	"destination_target" text NOT NULL,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"actor_user_id" uuid,
	"action" varchar(128) NOT NULL,
	"target_type" varchar(64) NOT NULL,
	"target_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "twoFactor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"secret" text NOT NULL,
	"backupCodes" text NOT NULL,
	"userId" uuid NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failedVerificationCount" integer DEFAULT 0 NOT NULL,
	"lockedUntil" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"twoFactorEnabled" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autofix_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"trigger" varchar(16) NOT NULL,
	"triggered_by_user_id" uuid,
	"branch" text,
	"pr_url" text,
	"error" text,
	"summary" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"estimated_cost_micros" integer,
	"review_status" varchar(16) DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"review_comment" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"environment_id" uuid,
	"release_id" uuid,
	"event_id" varchar(64) NOT NULL,
	"platform" varchar(64) DEFAULT 'javascript' NOT NULL,
	"level" varchar(32) DEFAULT 'error' NOT NULL,
	"logger" varchar(128),
	"transaction_name" text,
	"server_name" text,
	"message" text,
	"normalized_message" text,
	"timestamp" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sdk_name" varchar(128),
	"sdk_version" varchar(64),
	"dist" varchar(128),
	"user_identifier" text,
	"request_method" varchar(16),
	"request_url" text,
	"fingerprint_override" jsonb,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contexts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_rate_counters" (
	"scope" varchar(32) NOT NULL,
	"scope_id" uuid NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"registrations_enabled" boolean DEFAULT true NOT NULL,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_user" text,
	"smtp_pass_ciphertext" text,
	"smtp_from" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(32) NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_triage_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"generated_by_user_id" uuid,
	"provider" varchar(32) NOT NULL,
	"model" varchar(255),
	"status" varchar(16) DEFAULT 'succeeded' NOT NULL,
	"briefing" text,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cache_read_tokens" integer,
	"cache_write_tokens" integer,
	"estimated_cost_micros" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"environment_id" uuid,
	"release_id" uuid,
	"grouping_key" text NOT NULL,
	"grouping_version" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"culprit" text,
	"level" varchar(32) DEFAULT 'error' NOT NULL,
	"priority" varchar(16) DEFAULT 'medium' NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"is_regressed" boolean DEFAULT false NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_id" uuid,
	"times_seen" integer DEFAULT 1 NOT NULL,
	"assigned_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"ignored_until" timestamp with time zone,
	"external_issue_url" text,
	"merged_into_issue_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"project_id" uuid,
	"type" varchar(64) NOT NULL,
	"dedupe_key" varchar(255),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_credential_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credential_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_preview" varchar(16) NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"all_projects" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_ai_pricing_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"model" varchar(255) NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rates_per_million" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" varchar(16) DEFAULT 'anthropic' NOT NULL,
	"model" varchar(128),
	"anthropic_api_key_ciphertext" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_github_app_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"installation_id" varchar(64) NOT NULL,
	"github_repository_id" bigint NOT NULL,
	"full_name" text NOT NULL,
	"default_branch" varchar(255) NOT NULL,
	"private" boolean DEFAULT true NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_github_app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mode" varchar(16) DEFAULT 'cloud' NOT NULL,
	"html_url" text,
	"api_url" text,
	"git_user" varchar(64),
	"git_port" integer,
	"app_slug" varchar(128),
	"app_id" varchar(64),
	"client_id" varchar(128),
	"installation_id" varchar(64),
	"installation_account_login" varchar(255),
	"installation_account_type" varchar(32),
	"client_secret_ciphertext" text,
	"private_key_ciphertext" text,
	"webhook_secret_ciphertext" text,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_mcp_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"invited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_preview" varchar(12) NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_autofix_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"auto_trigger_on_new_issue" boolean DEFAULT false NOT NULL,
	"auto_merge" boolean DEFAULT false NOT NULL,
	"daily_cap" integer DEFAULT 5 NOT NULL,
	"target_branch" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"public_key" varchar(64) NOT NULL,
	"secret_key_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"rate_limit_per_minute" integer,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" integer GENERATED BY DEFAULT AS IDENTITY (sequence name "projects_public_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"team_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"platform" varchar(64) DEFAULT 'javascript' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"visibility" varchar(32) DEFAULT 'private' NOT NULL,
	"retention_days" integer DEFAULT 30 NOT NULL,
	"inbound_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ownership_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pii_scrub_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_event_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"release_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content_type" varchar(128),
	"size" integer NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version" varchar(255) NOT NULL,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repo_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" varchar(16) NOT NULL,
	"base_url" text,
	"html_url" text,
	"api_url" text,
	"git_user" varchar(64),
	"git_port" integer,
	"repo_identifier" text NOT NULL,
	"token_ciphertext" text,
	"default_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"last_validated_at" timestamp with time zone,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" varchar(128) NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"name" varchar(255),
	"avatar_url" text,
	"timezone" varchar(64),
	"locale" varchar(16),
	"last_login_at" timestamp with time zone,
	"is_super_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_model_pricing_provider_model_effective_idx" ON "ai_model_pricing_rules" USING btree ("provider","model","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_pricing_catalog_source_revision_idx" ON "ai_pricing_catalog_versions" USING btree ("source_url","source_revision");--> statement-breakpoint
CREATE INDEX "ai_usage_ledger_org_created_idx" ON "ai_usage_ledger" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_users_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "autofix_runs_issue_idx" ON "autofix_runs" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "autofix_runs_project_created_idx" ON "autofix_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "environments_project_name_idx" ON "environments" USING btree ("project_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "events_project_event_id_idx" ON "events" USING btree ("project_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_rate_counters_scope_window_idx" ON "ingest_rate_counters" USING btree ("scope","scope_id","window_started_at");--> statement-breakpoint
CREATE INDEX "ingest_rate_counters_updated_at_idx" ON "ingest_rate_counters" USING btree ("updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_hash_idx" ON "invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "issue_triage_runs_issue_created_idx" ON "issue_triage_runs" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issue_triage_runs_org_created_idx" ON "issue_triage_runs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "issues_project_grouping_idx" ON "issues" USING btree ("project_id","grouping_version","grouping_key");--> statement-breakpoint
CREATE INDEX "jobs_organization_created_idx" ON "jobs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_project_created_idx" ON "jobs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_run_at_idx" ON "jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_type_dedupe_pending_idx" ON "jobs" USING btree ("type","dedupe_key") WHERE "jobs"."dedupe_key" is not null and "jobs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_credential_projects_credential_project_idx" ON "mcp_credential_projects" USING btree ("credential_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_credentials_hash_idx" ON "mcp_credentials" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "mcp_credentials_organization_idx" ON "mcp_credentials" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_ai_pricing_override_lookup_idx" ON "organization_ai_pricing_overrides" USING btree ("organization_id","provider","model");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_ai_settings_org_idx" ON "organization_ai_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_github_app_repos_org_repo_idx" ON "organization_github_app_repositories" USING btree ("organization_id","github_repository_id");--> statement-breakpoint
CREATE INDEX "org_github_app_repos_installation_idx" ON "organization_github_app_repositories" USING btree ("organization_id","installation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_github_app_settings_org_idx" ON "organization_github_app_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_mcp_settings_org_idx" ON "organization_mcp_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_roles_key_idx" ON "organization_roles" USING btree ("organization_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_access_tokens_hash_idx" ON "personal_access_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "project_autofix_configs_project_idx" ON "project_autofix_configs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_keys_public_key_idx" ON "project_keys" USING btree ("public_key");--> statement-breakpoint
CREATE INDEX "project_saved_searches_project_idx" ON "project_saved_searches" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_public_id_idx" ON "projects" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_org_slug_idx" ON "projects" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "release_artifacts_release_name_idx" ON "release_artifacts" USING btree ("release_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_project_version_idx" ON "releases" USING btree ("project_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "repo_connections_project_idx" ON "repo_connections" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_idx" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_roles_team_key_idx" ON "team_roles" USING btree ("team_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_org_slug_idx" ON "teams" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");