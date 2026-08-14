import type { AutofixJobHandler } from "./autofix-job.handler";
import { AutofixWorkerRegistration } from "./autofix-worker.module";
import type { JobsRunnerService } from "../jobs/jobs-runner.service";
import type { Job } from "../jobs/jobs.service";

jest.mock("./autofix-job.handler", () => ({ AutofixJobHandler: class {} }));
jest.mock("./autofix.module", () => ({ AutofixModule: class {} }));
jest.mock("../jobs/jobs-worker.module", () => ({ JobsWorkerModule: class {} }));

describe("AutofixWorkerRegistration", () => {
  it("registers Autofix in the slow worker lane", async () => {
    const registerSlowHandler = jest.fn();
    const run = jest.fn().mockResolvedValue(undefined);
    const registration = new AutofixWorkerRegistration(
      { registerSlowHandler } as unknown as JobsRunnerService,
      { run } as unknown as AutofixJobHandler,
    );

    registration.onModuleInit();

    expect(registerSlowHandler).toHaveBeenCalledWith("autofix", expect.any(Function));
    const handler = registerSlowHandler.mock.calls[0][1] as (job: Job) => Promise<void>;
    const job = { id: "job-id", payload: { runId: "run-id" } } as Job;
    await handler(job);
    expect(run).toHaveBeenCalledWith(job);
  });
});
