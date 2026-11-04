CREATE TABLE "issue_pending_counts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issue_pending_counts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"issue_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"culprit" text,
	"level" varchar(32) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_pending_counts" ADD CONSTRAINT "issue_pending_counts_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_pending_counts_issue_idx" ON "issue_pending_counts" USING btree ("issue_id","id");