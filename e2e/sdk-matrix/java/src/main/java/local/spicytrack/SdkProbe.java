package local.spicytrack;

import io.sentry.Sentry;

public final class SdkProbe {
  private SdkProbe() {}

  private static final class a {
    private static void b() {
      Sentry.captureException(new RuntimeException("Real Java SDK compatibility probe"));
    }
  }

  public static void main(String[] args) {
    Sentry.init(options -> {
      options.setDsn(System.getenv("SPICYTRACK_DSN"));
      options.setEnvironment("sdk-matrix");
      options.setRelease("sdk-java@8.52.0");
    });
    a.b();
    Sentry.flush(10_000);
    Sentry.close();
  }
}
