import { randomUUID } from "node:crypto";

export const TEST_EVENT_SDK_NAME = "spicytrack.test-event";

/**
 * A realistic error event for the "Send test event" button. Its fixed fingerprint groups
 * every test event into a single issue instead of cluttering the project.
 */
export function buildTestEvent(input: { platform: string; sentBy: string; now?: Date }) {
  const now = input.now ?? new Date();
  return {
    event_id: randomUUID().replace(/-/g, ""),
    timestamp: now.getTime() / 1000,
    platform: input.platform,
    level: "error",
    logger: "spicytrack",
    environment: "spicytrack-test",
    fingerprint: ["spicytrack-test-event"],
    exception: {
      values: [
        {
          type: "SpicyTrackTestError",
          value: "This is a test event sent from SpicyTrack. Your project can receive errors.",
          mechanism: { type: "generic", handled: true },
          stacktrace: {
            frames: [
              {
                filename: "spicytrack/onboarding.js",
                function: "sendTestEvent",
                lineno: 12,
                colno: 9,
                in_app: true,
                context_line: '  throw new SpicyTrackTestError("This is a test event");',
              },
            ],
          },
        },
      ],
    },
    tags: { test_event: "true" },
    extra: { sentBy: input.sentBy },
    sdk: { name: TEST_EVENT_SDK_NAME, version: "1.0.0" },
  };
}
