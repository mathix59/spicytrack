import { retentionSettings } from "./retention-cleanup.handler";

describe("retentionSettings", () => {
  const names = [
    "JOBS_SUCCEEDED_RETENTION_DAYS",
    "JOBS_FAILED_RETENTION_DAYS",
    "ALERT_DELIVERY_RETENTION_DAYS",
    "AUDIT_LOG_RETENTION_DAYS",
  ];
  afterEach(() => names.forEach((name) => delete process.env[name]));

  it("uses defaults and accepts overrides", () => {
    expect(retentionSettings()).toEqual({
      succeededJobsDays: 7,
      failedJobsDays: 30,
      alertDeliveriesDays: 30,
      auditLogsDays: 365,
    });

    process.env.JOBS_SUCCEEDED_RETENTION_DAYS = "2";
    process.env.AUDIT_LOG_RETENTION_DAYS = "0";
    expect(retentionSettings()).toMatchObject({ succeededJobsDays: 2, auditLogsDays: 0 });
  });

  it("ignores invalid values instead of deleting everything", () => {
    process.env.JOBS_FAILED_RETENTION_DAYS = "0";
    process.env.ALERT_DELIVERY_RETENTION_DAYS = "-3";
    process.env.AUDIT_LOG_RETENTION_DAYS = "soon";

    expect(retentionSettings()).toMatchObject({
      failedJobsDays: 30,
      alertDeliveriesDays: 30,
      auditLogsDays: 365,
    });
  });
});
