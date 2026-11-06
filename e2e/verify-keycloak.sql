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
END $$;
