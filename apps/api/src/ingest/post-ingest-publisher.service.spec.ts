import type { JobsService } from "../jobs/jobs.service";
import { PostIngestPublisherService } from "./post-ingest-publisher.service";
import type { PostIngestAdminJobPayload } from "./post-ingest-job";

const payload = (
  overrides: Partial<PostIngestAdminJobPayload> = {},
): PostIngestAdminJobPayload => ({
  organizationId: "org",
  projectId: "project",
  issueId: "issue",
  eventId: "event",
  issueTitle: "TypeError",
  issueStatus: "unresolved",
  timesSeen: 3,
  issueWasCreated: false,
  issueRegressed: false,
  ...overrides,
});

describe("PostIngestPublisherService", () => {
  const enqueue = jest.fn().mockResolvedValue(undefined);
  const publisher = new PostIngestPublisherService({ enqueue } as unknown as JobsService);

  beforeEach(() => enqueue.mockClear());

  it("queues a job per event that creates or regresses its issue, to run now", async () => {
    await publisher.enqueue(payload({ eventId: "created", issueWasCreated: true }), 12_345);
    await publisher.enqueue(payload({ eventId: "regressed", issueRegressed: true }), 12_345);

    expect(enqueue.mock.calls.map(([, , runAt, options]) => [runAt, options.dedupeKey])).toEqual([
      [new Date(12_345), "created"],
      [new Date(12_345), "regressed"],
    ]);
  });

  it("queues one job per issue and five-second window for other events, run when it closes", async () => {
    await publisher.enqueue(payload({ eventId: "a" }), 10_000);
    await publisher.enqueue(payload({ eventId: "b" }), 14_999);
    await publisher.enqueue(payload({ eventId: "c" }), 15_000);
    await publisher.enqueue(payload({ eventId: "d", issueId: "other" }), 14_999);

    expect(enqueue.mock.calls.map(([, , runAt, options]) => [runAt, options.dedupeKey])).toEqual([
      [new Date(15_000), "issue:issue:10000"],
      [new Date(15_000), "issue:issue:10000"],
      [new Date(20_000), "issue:issue:15000"],
      [new Date(15_000), "issue:other:10000"],
    ]);
  });
});
