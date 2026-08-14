DO $$
DECLARE
  auth_user_id uuid;
  target_organization_id uuid;
BEGIN
  SELECT id INTO auth_user_id FROM "user" WHERE email = 'sso-user@spicytrack.local';
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Keycloak user was not provisioned';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "account"
    WHERE user_id = auth_user_id AND provider_id = 'keycloak'
  ) THEN
    RAISE EXCEPTION 'Keycloak account link is missing';
  END IF;

  SELECT id INTO target_organization_id FROM organizations WHERE slug = 'e2e-company';
  IF NOT EXISTS (
    SELECT 1
    FROM organization_members membership
    JOIN users app_user ON app_user.id = membership.user_id
    WHERE membership.organization_id = target_organization_id
      AND app_user.email = 'sso-user@spicytrack.local'
      AND membership.role = 'member'
  ) THEN
    RAISE EXCEPTION 'Invited Keycloak user did not become a member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM invitations
    WHERE organization_id = target_organization_id
      AND email = 'sso-user@spicytrack.local'
      AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Keycloak invitation was not consumed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM audit_logs
    WHERE audit_logs.organization_id = target_organization_id
      AND actor_user_id = auth_user_id
      AND action = 'auth.sso_login'
  ) THEN
    RAISE EXCEPTION 'SSO audit entry is missing';
  END IF;

  IF EXISTS (SELECT 1 FROM "user" WHERE email = 'blocked-user@spicytrack.local')
    OR EXISTS (SELECT 1 FROM users WHERE email = 'blocked-user@spicytrack.local') THEN
    RAISE EXCEPTION 'Uninvited Keycloak user was provisioned';
  END IF;

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
