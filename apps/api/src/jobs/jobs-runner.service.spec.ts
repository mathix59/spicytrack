import { Logger } from "@nestjs/common";
import { RetentionCleanupHandler } from "./handlers/retention-cleanup.handler";
import { JobsRunnerService } from "./jobs-runner.service";
import { JobsService } from "./jobs.service";

describe("JobsRunnerService", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("contains database errors raised by a polling lane", async () => {
    jest.useFakeTimers();
    const error = new Error("database unavailable");
    const logger = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const jobsService = {
      hasPending: jest.fn().mockResolvedValue(true),
      claimNext: jest.fn().mockRejectedValue(error),
    } as unknown as JobsService;
    const runner = new JobsRunnerService(jobsService, {
      run: jest.fn(),
    } as unknown as RetentionCleanupHandler);
    runner.registerSlowHandler("autofix", jest.fn());

    await runner.onModuleInit();
    await jest.advanceTimersByTimeAsync(5_000);

    expect(logger).toHaveBeenCalledWith(
      "Job slow polling failed: database unavailable",
      error.stack,
    );
    runner.onModuleDestroy();
  });
});
