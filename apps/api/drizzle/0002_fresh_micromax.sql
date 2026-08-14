ALTER TABLE "alert_rules" RENAME COLUMN "trigger_type" TO "trigger_types";
ALTER TABLE "alert_rules" ALTER COLUMN "trigger_types" TYPE text[] USING ARRAY["trigger_types"]::text[];
