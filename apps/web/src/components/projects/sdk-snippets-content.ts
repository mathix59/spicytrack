import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { renderNullableText } from "@/lib/utils";

import { getSdkSnippet } from "./sdk-init-snippet";

function platformLabel(platform?: string | null) {
  return (
    PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ??
    renderNullableText(platform, "SDK")
  );
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

  if (platform === "java") {
    return "implementation 'io.sentry:sentry:7.+'";
  }

  if (platform === "dotnet") {
    return "dotnet add package Sentry";
  }

  if (platform === "php") {
    return "composer require sentry/sentry";
  }

  if (platform === "ruby") {
    return "bundle add sentry-ruby";
  }

  if (platform === "rust") {
    return "cargo add sentry";
  }

  if (platform === "dart") {
    return "flutter pub add sentry_flutter";
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

  if (platform === "java") {
    return `try {
  throw new RuntimeException("SpicyTrack setup check");
} catch (Exception e) {
  Sentry.captureException(e);
}`;
  }

  if (platform === "dotnet") {
    return 'SentrySdk.CaptureMessage("SpicyTrack setup check");';
  }

  if (platform === "php") {
    return 'Sentry\\captureException(new Exception("SpicyTrack setup check"));';
  }

  if (platform === "ruby") {
    return `begin
  1 / 0
rescue => e
  Sentry.capture_exception(e)
end`;
  }

  if (platform === "rust") {
    return `sentry::capture_message("SpicyTrack setup check", sentry::Level::Info);`;
  }

  if (platform === "dart") {
    return `await Sentry.captureMessage("SpicyTrack setup check");`;
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

  if (platform === "java") {
    return "java";
  }

  if (platform === "dotnet") {
    return "csharp";
  }

  if (platform === "php") {
    return "php";
  }

  if (platform === "ruby") {
    return "ruby";
  }

  if (platform === "rust") {
    return "rust";
  }

  if (platform === "dart") {
    return "dart";
  }

  return "javascript";
}

export { getSdkInstallSnippet, getSdkLanguage, getSdkSnippet, getSdkTestSnippet, platformLabel };
