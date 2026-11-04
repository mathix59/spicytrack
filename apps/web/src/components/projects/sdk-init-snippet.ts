/** The SDK init snippet for a platform, with the project's DSN filled in. */
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
    return `import os

import sentry_sdk

sentry_sdk.init(
    dsn="${dsn}",
    environment=os.getenv("ENVIRONMENT"),
    release=os.getenv("APP_VERSION"),
)`;
  }

  if (platform === "go") {
    return `import (
  "log"
  "os"
  "time"

  "github.com/getsentry/sentry-go"
)

err := sentry.Init(sentry.ClientOptions{
  Dsn: "${dsn}",
  Environment: os.Getenv("ENVIRONMENT"),
  Release: os.Getenv("APP_VERSION"),
})
if err != nil {
  log.Fatalf("sentry init: %v", err)
}
// Flush buffered events before the program exits.
defer sentry.Flush(2 * time.Second)`;
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
    return `let _guard = sentry::init(("${dsn}", sentry::ClientOptions {
    release: sentry::release_name!(),
    environment: std::env::var("ENVIRONMENT").ok().map(Into::into),
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

export { getSdkSnippet };
