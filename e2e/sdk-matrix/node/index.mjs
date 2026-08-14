import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SPICYTRACK_DSN,
  environment: "sdk-matrix",
  release: "sdk-node@10.69.0",
  sendDefaultPii: false,
});
Sentry.captureException(new Error("Real Node SDK compatibility probe"));
if (!(await Sentry.flush(10_000))) throw new Error("Node SDK failed to flush its event");
