import { BadRequestException, ConflictException, HttpException, Logger } from "@nestjs/common";
import { AutofixService } from "./autofix.service";

function emptySelect() {
  return {
    from: jest.fn(() => ({
      where: jest.fn(() => ({ limit: jest.fn(async () => []) })),
    })),
  };
}

describe("AutofixService configuration", () => {
  const db = { select: jest.fn(() => emptySelect()) };
  const service = new AutofixService(
    db as never,
    {} as never,
    {} as never,
    { record: jest.fn() } as never,
    {} as never,
  );

  beforeEach(() => {
    db.select.mockClear();
  });

  it("keeps automatic merge disabled by default", async () => {
    await expect(service.getConfig("project-id")).resolves.toEqual({
      enabled: false,
      autoTriggerOnNewIssue: false,
      autoMerge: false,
      autoFixAfterAnalysis: false,
      requirePassingChecks: true,
      dailyCap: 5,
      targetBranch: null,
    });
  });

  it("requires an explicit target branch before enabling automatic merge", async () => {
    await expect(
      service.updateConfig({
        organizationId: "organization-id",
        projectId: "project-id",
        actorUserId: "user-id",
        autoMerge: true,
      }),
    ).rejects.toThrow(
      new BadRequestException("targetBranch is required when autoMerge is enabled"),
    );
  });
});

describe("AutofixService.startFix", () => {
  function serviceWithRun(run: Record<string, unknown>) {
    const update = jest.fn();
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({ limit: jest.fn(async () => [run]) })),
        })),
      })),
      update,
    };
    const service = new AutofixService(
      db as never,
      {} as never,
      { enqueue: jest.fn() } as never,
      { record: jest.fn() } as never,
      { assertCanSpend: jest.fn() } as never,
    );
    return { service, update };
  }

  const input = {
    organizationId: "organization-id",
    projectId: "project-id",
    runId: "run-id",
    actorUserId: "user-id",
  };

  it.each([
    ["a run still analyzing", { phase: "analysis", status: "running", analysis: null }],
    ["a run without analysis", { phase: "fix", status: "failed", analysis: null }],
    ["a fix waiting for CI", { phase: "fix", status: "checking", analysis: { rootCause: "x" } }],
    ["a merged fix", { phase: "fix", status: "succeeded", analysis: { rootCause: "x" } }],
  ])("refuses %s", async (_label, run) => {
    const { service, update } = serviceWithRun({ id: "run-id", ...run });

    await expect(service.startFix(input)).rejects.toThrow(
      new ConflictException("Only an analyzed run can generate a fix."),
    );
    expect(update).not.toHaveBeenCalled();
  });
});

describe("AutofixService.maybeAutoTrigger", () => {
  function service(assertCanSpend: jest.Mock) {
    const issue = { id: "issue-id" };
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({ limit: jest.fn(async () => [issue]) })),
        })),
      })),
    };
    const enqueue = jest.fn();
    const instance = new AutofixService(
      db as never,
      { findConnection: jest.fn(async () => ({ id: "connection-id" })) } as never,
      { enqueue } as never,
      { record: jest.fn() } as never,
      { assertCanSpend } as never,
    );
    jest.spyOn(instance, "getConfig").mockResolvedValue({
      enabled: true,
      autoTriggerOnNewIssue: true,
      autoMerge: false,
      autoFixAfterAnalysis: false,
      requirePassingChecks: true,
      dailyCap: 5,
      targetBranch: null,
    });
    jest.spyOn(instance as never, "countRunsToday").mockResolvedValue(0 as never);
    jest
      .spyOn(instance as never, "getOrgAiConfig")
      .mockResolvedValue({ provider: "anthropic" } as never);
    return { instance, enqueue };
  }

  it("skips a new issue once the monthly budget is spent, with a warning", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { instance, enqueue } = service(
      jest.fn(async () => {
        throw new HttpException("This organization spent its monthly AI budget of $25.00.", 429);
      }),
    );

    await expect(
      instance.maybeAutoTrigger("organization-id", "project-id", "issue-id"),
    ).resolves.toBeUndefined();
    expect(enqueue).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      "Automatic analysis skipped for issue issue-id: This organization spent its monthly AI budget of $25.00.",
    );
    warn.mockRestore();
  });
});

describe("AutofixService.getAvailability", () => {
  const enabledConfig = {
    enabled: true,
    autoTriggerOnNewIssue: false,
    autoMerge: false,
    autoFixAfterAnalysis: false,
    requirePassingChecks: true,
    dailyCap: 5,
    targetBranch: null,
  };

  function service(input: { connection: unknown; aiKey: string | null; enabled: boolean }) {
    const db = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(async () => (input.aiKey ? [{ apiKeyCiphertext: input.aiKey }] : [])),
          })),
        })),
      })),
    };
    const instance = new AutofixService(
      db as never,
      { findConnection: jest.fn(async () => input.connection) } as never,
      {} as never,
      { record: jest.fn() } as never,
      {} as never,
    );
    jest
      .spyOn(instance, "getConfig")
      .mockResolvedValue({ ...enabledConfig, enabled: input.enabled });
    return instance;
  }

  it("is available once a repository, an AI key and the project setting are in place", async () => {
    await expect(
      service({
        connection: { id: "connection-id" },
        aiKey: "cipher",
        enabled: true,
      }).getAvailability("organization-id", "project-id"),
    ).resolves.toEqual({ available: true, missing: [] });
  });

  it("lists every missing requirement in setup order", async () => {
    await expect(
      service({ connection: null, aiKey: null, enabled: false }).getAvailability(
        "organization-id",
        "project-id",
      ),
    ).resolves.toEqual({ available: false, missing: ["repository", "ai_key", "enabled"] });
  });

  it("reports a project with Autofix turned off as unavailable", async () => {
    await expect(
      service({
        connection: { id: "connection-id" },
        aiKey: "cipher",
        enabled: false,
      }).getAvailability("organization-id", "project-id"),
    ).resolves.toEqual({ available: false, missing: ["enabled"] });
  });
});
