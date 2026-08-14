import { BadRequestException } from "@nestjs/common";
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
  );

  beforeEach(() => {
    db.select.mockClear();
  });

  it("keeps automatic merge disabled by default", async () => {
    await expect(service.getConfig("project-id")).resolves.toEqual({
      enabled: false,
      autoTriggerOnNewIssue: false,
      autoMerge: false,
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
