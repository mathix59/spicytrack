import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { renderNullableText } from "@/lib/utils";

function platformLabel(platform?: string | null) {
  return (
    PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ??
    renderNullableText(platform, "SDK")
  );
}

function getSdkSnippet(platform: string, dsn: string) {
  if (platform === "react") {
    return `import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "${dsn}",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
});

export default Sentry;`;
  }

  if (platform === "node") {
    return `import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "${dsn}",
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
});`;
  }

  if (platform === "python") {
    return `import sentry_sdk

sentry_sdk.init(
    dsn="${dsn}",
    environment=os.getenv("ENVIRONMENT"),
    release=os.getenv("APP_VERSION"),
)`;
  }

  if (platform === "go") {
    return `import "github.com/getsentry/sentry-go"

err := sentry.Init(sentry.ClientOptions{
  Dsn: "${dsn}",
  Environment: os.Getenv("ENVIRONMENT"),
  Release: os.Getenv("APP_VERSION"),
})
if err != nil {
  log.Fatalf("sentry init: %v", err)
}`;
  }

  return `import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "${dsn}",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
});`;
}

function getSdkInstallSnippet(platform: string) {
  if (platform === "node") {
    return "pnpm add @sentry/node";
  }

  if (platform === "react") {
    return "pnpm add @sentry/react";
  }

  if (platform === "python") {
    return "pip install sentry-sdk";
  }

  if (platform === "go") {
    return "go get github.com/getsentry/sentry-go";
  }

  return "pnpm add @sentry/browser";
}

function getSdkTestSnippet(platform: string) {
  if (platform === "node") {
    return `try {
  throw new Error("SpicyTrack setup check");
} catch (error) {
  Sentry.captureException(error);
}`;
  }

  if (platform === "python") {
    return `try:
    raise RuntimeError("SpicyTrack setup check")
except Exception as exc:
    sentry_sdk.capture_exception(exc)`;
  }

  if (platform === "go") {
    return `sentry.CaptureMessage("SpicyTrack setup check")
sentry.Flush(2 * time.Second)`;
  }

  return 'Sentry.captureException(new Error("SpicyTrack setup check"));';
}

function getSdkLanguage(platform: string) {
  if (platform === "react") {
    return "tsx";
  }

  if (platform === "python") {
    return "python";
  }

  if (platform === "go") {
    return "go";
  }

  return "javascript";
}

export { getSdkInstallSnippet, getSdkLanguage, getSdkSnippet, getSdkTestSnippet, platformLabel };
