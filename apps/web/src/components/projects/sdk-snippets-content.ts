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

  if (platform === "java") {
    return `import io.sentry.Sentry;

Sentry.init(options -> {
  options.setDsn("${dsn}");
  options.setEnvironment(System.getenv("ENVIRONMENT"));
  options.setRelease(System.getenv("APP_VERSION"));
});`;
  }

  if (platform === "dotnet") {
    return `using Sentry;

SentrySdk.Init(o => {
  o.Dsn = "${dsn}";
  o.Environment = Environment.GetEnvironmentVariable("ENVIRONMENT");
  o.Release = Environment.GetEnvironmentVariable("APP_VERSION");
});`;
  }

  if (platform === "php") {
    return `require_once 'vendor/autoload.php';

Sentry\\init([
    'dsn' => '${dsn}',
    'environment' => getenv('ENVIRONMENT'),
    'release' => getenv('APP_VERSION'),
]);`;
  }

  if (platform === "ruby") {
    return `require "sentry-ruby"

Sentry.init do |config|
  config.dsn = "${dsn}"
  config.environment = ENV["ENVIRONMENT"]
  config.release = ENV["APP_VERSION"]
end`;
  }

  if (platform === "rust") {
    return `use sentry::{ClientOptions, IntoString};

let _guard = sentry::init(("${dsn}", ClientOptions {
    release: Some("APP_VERSION".into()),
    environment: Some("ENVIRONMENT".into()),
    ..Default::default()
}));`;
  }

  if (platform === "dart") {
    return `import 'package:sentry_flutter/sentry_flutter.dart';

await SentryFlutter.init(
  (options) {
    options.dsn = '${dsn}';
    options.environment = const String.fromEnvironment('ENVIRONMENT');
    options.release = const String.fromEnvironment('APP_VERSION');
  },
);`;
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

  if (platform === "java") {
    return "implementation 'io.sentry:sentry-spring-boot-starter:7.+'";
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
    return "dart pub add sentry_flutter";
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
    return `Sentry.captureMessage("SpicyTrack setup check");`;
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
