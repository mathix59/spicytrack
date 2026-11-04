-- Events become a table partitioned by week on ingested_at, so retention drops whole partitions
-- instead of deleting rows one by one. The existing table is attached as the partition for
-- everything before the next week, without copying rows; it is dropped once all of it expires.
ALTER TABLE "events" RENAME TO "events_legacy";--> statement-breakpoint
ALTER TABLE "events_legacy" DROP CONSTRAINT "events_pkey";--> statement-breakpoint
ALTER TABLE "events_legacy" ADD CONSTRAINT "events_legacy_pkey" PRIMARY KEY ("id", "ingested_at");--> statement-breakpoint
-- A unique event_id cannot span partitions: ingest takes an advisory lock on it instead.
DROP INDEX "events_project_event_id_idx";--> statement-breakpoint
CREATE INDEX "events_legacy_project_event_id_idx" ON "events_legacy" USING btree ("project_id", "event_id");--> statement-breakpoint
ALTER INDEX "events_issue_timestamp_idx" RENAME TO "events_legacy_issue_timestamp_idx";--> statement-breakpoint
ALTER INDEX "events_project_timestamp_idx" RENAME TO "events_legacy_project_timestamp_idx";--> statement-breakpoint
ALTER INDEX "events_project_environment_issue_idx" RENAME TO "events_legacy_project_environment_issue_idx";--> statement-breakpoint
ALTER INDEX "events_project_release_issue_idx" RENAME TO "events_legacy_project_release_issue_idx";--> statement-breakpoint
ALTER INDEX "events_project_ingested_idx" RENAME TO "events_legacy_project_ingested_idx";--> statement-breakpoint
ALTER INDEX "events_merged_from_idx" RENAME TO "events_legacy_merged_from_idx";--> statement-breakpoint
ALTER INDEX "events_tags_idx" RENAME TO "events_legacy_tags_idx";--> statement-breakpoint
CREATE TABLE "events" (LIKE "events_legacy" INCLUDING DEFAULTS) PARTITION BY RANGE ("ingested_at");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_id_ingested_at_pk" PRIMARY KEY ("id", "ingested_at");--> statement-breakpoint
CREATE INDEX "events_project_event_id_idx" ON "events" USING btree ("project_id", "event_id");--> statement-breakpoint
CREATE INDEX "events_issue_timestamp_idx" ON "events" USING btree ("issue_id", "timestamp");--> statement-breakpoint
CREATE INDEX "events_project_timestamp_idx" ON "events" USING btree ("project_id", "timestamp");--> statement-breakpoint
CREATE INDEX "events_project_environment_issue_idx" ON "events" USING btree ("project_id", "environment_id", "issue_id");--> statement-breakpoint
CREATE INDEX "events_project_release_issue_idx" ON "events" USING btree ("project_id", "release_id", "issue_id");--> statement-breakpoint
CREATE INDEX "events_project_ingested_idx" ON "events" USING btree ("project_id", "ingested_at");--> statement-breakpoint
CREATE INDEX "events_merged_from_idx" ON "events" USING btree ("merged_from_issue_id") WHERE "merged_from_issue_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "events_tags_idx" ON "events" USING gin ("tags");--> statement-breakpoint
-- The legacy indexes match the parent's, so attaching reuses them instead of building new ones.
-- Weeks start on Monday, UTC; the worker creates later weeks ahead of time. The default
-- partition only catches rows when the worker has not run for weeks.
DO $$
DECLARE
  cutover timestamptz := date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' + interval '7 days';
  week_start timestamptz;
BEGIN
  EXECUTE format(
    'ALTER TABLE events ATTACH PARTITION events_legacy FOR VALUES FROM (MINVALUE) TO (%L)',
    cutover
  );
  FOR i IN 0..3 LOOP
    week_start := cutover + make_interval(days => 7 * i);
    EXECUTE format(
      'CREATE TABLE %I PARTITION OF events FOR VALUES FROM (%L) TO (%L)',
      'events_p' || to_char(week_start AT TIME ZONE 'UTC', 'YYYYMMDD'),
      week_start,
      week_start + interval '7 days'
    );
  END LOOP;
END $$;--> statement-breakpoint
CREATE TABLE "events_default" PARTITION OF "events" DEFAULT;
