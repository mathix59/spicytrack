import 'dart:io';

import 'package:sentry/sentry.dart';

class a {
  static Future<void> b() async {
    await Sentry.captureException(
      StateError('Real Dart SDK compatibility probe'),
      stackTrace: StackTrace.current,
    );
  }
}

Future<void> main() async {
  await Sentry.init((options) {
    options.dsn = Platform.environment['SPICYTRACK_DSN']!;
    options.environment = 'sdk-matrix';
    options.release = 'sdk-dart@9.26.0';
  });
  await a.b();
  await Sentry.close();
}
