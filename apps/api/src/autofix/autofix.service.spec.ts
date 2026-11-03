import { BadRequestException, ConflictException } from "@nestjs/common";
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
