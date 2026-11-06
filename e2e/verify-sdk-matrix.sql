DO $$
BEGIN
  IF (
    SELECT COUNT(DISTINCT sdk_name)
    FROM events
    WHERE sdk_name IN (
      'sentry.javascript.browser',
      'sentry.javascript.react',
      'sentry.javascript.node',
      'sentry.python',
      'sentry.go',
      'sentry.java',
      'sentry.dotnet',
      'sentry.php',
      'sentry.ruby',
      'sentry.rust',
      'sentry.dart'
    )
      AND release_id IN (
        SELECT id FROM releases
        WHERE version IN (
          'sdk-browser@10.69.0',
          'sdk-react@10.69.0',
          'sdk-node@10.69.0',
          'sdk-python@2.66.1',
          'sdk-go@0.48.0',
          'sdk-java@8.52.0',
          'sdk-dotnet@6.8.0',
          'sdk-php@4.30.0',
          'sdk-ruby@6.7.0',
          'sdk-rust@0.49.1',
          'sdk-dart@9.26.0'
        )
      )
  ) <> 11 THEN
    RAISE EXCEPTION 'Real Sentry SDK compatibility matrix is incomplete';
  END IF;
END $$;
