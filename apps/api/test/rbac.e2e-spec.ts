import { handleBetterAuthRequest, getBetterAuthSession } from "../src/auth/better-auth";
import { randomUUID } from "node:crypto";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Pool } from "pg";
import { AppModule } from "../src/app.module";
import { hashOpaqueToken } from "../src/common/tokens";
import { DATABASE_POOL } from "../src/database/database.provider";
import { ROLE_PERMISSIONS } from "../src/rbac/permissions.constants";

const systemRoles = Object.keys(ROLE_PERMISSIONS) as Array<keyof typeof ROLE_PERMISSIONS>;

describe("RBAC authorization matrix (e2e)", () => {
  let app: NestFastifyApplication;
  let pool: Pool;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const organizationId = randomUUID();
  const otherOrganizationId = randomUUID();
  const teamId = randomUUID();
  const otherTeamId = randomUUID();
  const projectId = randomUUID();
  const siblingProjectId = randomUUID();
  const issueId = randomUUID();
  const siblingIssueId = randomUUID();
  const eventId = randomUUID();
  const siblingEventId = randomUUID();
  const autofixRunId = randomUUID();
  const siblingAutofixRunId = randomUUID();
  const siblingSavedSearchId = randomUUID();
  const siblingProjectKeyId = randomUUID();
  const siblingAlertRuleId = randomUUID();
  const primaryReleaseId = randomUUID();
  const siblingReleaseId = randomUUID();
  const siblingOnlyReleaseId = randomUUID();
  const siblingArtifactId = randomUUID();
  const organizationSlug = `rbac-${suffix}`;
  const otherOrganizationSlug = `rbac-other-${suffix}`;
  const projectSlug = `project-${suffix}`;
  const siblingProjectSlug = `project-sibling-${suffix}`;
  const teamSlug = `team-${suffix}`;
  const customRoleKey = `limited-${Math.random().toString(16).slice(2, 10)}`;
  const adminCopyRoleKey = `admin-copy-${Math.random().toString(16).slice(2, 10)}`;
  const userIds: string[] = [];
  const userIdByLabel = new Map<string, string>();
  const memberIds = new Map<string, string>();
  const tokens = new Map<string, string>();

  async function createUser(label: string, role?: string) {
    const userId = randomUUID();
    const tokenId = randomUUID();
    const token = `pat_rbac_${label}_${randomUUID()}`;
    userIds.push(userId);
    userIdByLabel.set(label, userId);
    tokens.set(label, token);
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name, is_super_admin)
       VALUES ($1, $2, '', $3, $4)`,
      [userId, `${label}-${suffix}@example.test`, `RBAC ${label}`, label === "owner"],
    );
    await pool.query(
      `INSERT INTO personal_access_tokens (id, user_id, name, token_hash, token_preview)
       VALUES ($1, $2, 'RBAC E2E', $3, $4)`,
      [tokenId, userId, hashOpaqueToken(token), token.slice(-12)],
    );
    if (role) {
      const memberId = randomUUID();
      memberIds.set(label, memberId);
      await pool.query(
        `INSERT INTO organization_members (id, organization_id, user_id, role)
         VALUES ($1, $2, $3, $4)`,
        [memberId, organizationId, userId, role],
      );
    }
    return userId;
  }

  function authorization(label: string) {
    return { authorization: `Bearer ${tokens.get(label)}` };
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    pool = moduleFixture.get(DATABASE_POOL);

    const ownerUserId = await createUser("owner");
    await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_user_id)
       VALUES ($1, 'RBAC E2E', $2, $3)`,
      [organizationId, organizationSlug, ownerUserId],
    );
    await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_user_id)
       VALUES ($1, 'RBAC Other E2E', $2, $3)`,
      [otherOrganizationId, otherOrganizationSlug, ownerUserId],
    );

    for (const role of systemRoles) {
      await pool.query(
        `INSERT INTO organization_roles (organization_id, key, name, permissions, is_system)
         VALUES ($1, $2, $3, $4::jsonb, true)`,
        [organizationId, role, role, JSON.stringify(ROLE_PERMISSIONS[role])],
      );
      if (role === "owner") {
        const memberId = randomUUID();
        memberIds.set(role, memberId);
        await pool.query(
          `INSERT INTO organization_members (id, organization_id, user_id, role)
           VALUES ($1, $2, $3, 'owner')`,
          [memberId, organizationId, ownerUserId],
        );
      } else {
        await createUser(role, role);
      }
    }

    const orgOnlyPermissions = ["org.read", "org.teams.read", "org.projects.read"];
    for (const role of ["team-user", "outsider"]) {
      await pool.query(
        `INSERT INTO organization_roles (organization_id, key, name, permissions)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [organizationId, role, role, JSON.stringify(orgOnlyPermissions)],
      );
      await createUser(role, role);
    }
    await pool.query(
      `INSERT INTO organization_roles (organization_id, key, name, permissions)
       VALUES ($1, 'global-custom', 'Global custom', $2::jsonb)`,
      [
        organizationId,
        JSON.stringify(["org.read", "org.projects.read", "project.read", "project.keys.read"]),
      ],
    );
    await createUser("global-custom", "global-custom");
    await createUser("non-member");

    await pool.query(
      `INSERT INTO teams (id, organization_id, name, slug) VALUES ($1, $2, 'RBAC Team', $3)`,
      [teamId, organizationId, teamSlug],
    );
    await pool.query(
      `INSERT INTO team_roles (organization_id, team_id, key, name, permissions, is_system)
       VALUES ($1, $2, 'viewer', 'Viewer', '["view_projects"]'::jsonb, true)`,
      [organizationId, teamId],
    );
    await pool.query(
      `INSERT INTO team_roles (organization_id, team_id, key, name, permissions)
       VALUES ($1, $2, 'issues-only', 'Issues only', '["manage_issues"]'::jsonb)`,
      [organizationId, teamId],
    );
    await pool.query(
      `INSERT INTO team_members (organization_id, team_id, user_id, role)
       VALUES ($1, $2, $3, 'viewer')`,
      [organizationId, teamId, userIdByLabel.get("team-user")],
    );
    await pool.query(
      `INSERT INTO team_members (organization_id, team_id, user_id, role)
       VALUES ($1, $2, $3, 'issues-only')`,
      [organizationId, teamId, userIdByLabel.get("outsider")],
    );
    await pool.query(
      `INSERT INTO teams (id, organization_id, name, slug)
       VALUES ($1, $2, 'Other organization team', $3)`,
      [otherTeamId, otherOrganizationId, `other-team-${suffix}`],
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, team_id, name, slug)
       VALUES ($1, $2, $3, 'RBAC Project', $4),
              ($5, $2, $3, 'RBAC Sibling Project', $6)`,
      [projectId, organizationId, teamId, projectSlug, siblingProjectId, siblingProjectSlug],
    );
    await pool.query(
      `INSERT INTO issues (id, organization_id, project_id, grouping_key, title)
       VALUES ($1, $2, $3, $4, 'Primary issue'),
              ($5, $2, $6, $7, 'Sibling issue')`,
      [
        issueId,
        organizationId,
        projectId,
        `primary-${suffix}`,
        siblingIssueId,
        siblingProjectId,
        `sibling-${suffix}`,
      ],
    );
    await pool.query(
      `INSERT INTO events (
         id, organization_id, project_id, issue_id, event_id, timestamp, raw_payload
       ) VALUES
         ($1, $2, $3, $4, $5, NOW(), '{}'::jsonb),
         ($6, $2, $7, $8, $9, NOW(), '{}'::jsonb)`,
      [
        eventId,
        organizationId,
        projectId,
        issueId,
        `event-primary-${suffix}`,
        siblingEventId,
        siblingProjectId,
        siblingIssueId,
        `event-sibling-${suffix}`,
      ],
    );
    await pool.query(
      `INSERT INTO autofix_runs (id, organization_id, project_id, issue_id, trigger)
       VALUES ($1, $2, $3, $4, 'manual'), ($5, $2, $6, $7, 'manual')`,
      [
        autofixRunId,
        organizationId,
        projectId,
        issueId,
        siblingAutofixRunId,
        siblingProjectId,
        siblingIssueId,
      ],
    );
    await pool.query(
      `INSERT INTO project_saved_searches (id, organization_id, project_id, user_id, name, filters)
       VALUES ($1, $2, $3, $4, 'Sibling search', '{}'::jsonb)`,
      [siblingSavedSearchId, organizationId, siblingProjectId, ownerUserId],
    );
    await pool.query(
      `INSERT INTO project_keys (id, organization_id, project_id, name, public_key)
       VALUES ($1, $2, $3, 'Sibling key', $4)`,
      [siblingProjectKeyId, organizationId, siblingProjectId, `rbac-key-${suffix}`],
    );
    await pool.query(
      `INSERT INTO alert_rules (
         id, organization_id, project_id, name, trigger_types, destination_type, destination_target
       ) VALUES ($1, $2, $3, 'Sibling alert', ARRAY['new_issue'], 'webhook', 'https://example.test/hook')`,
      [siblingAlertRuleId, organizationId, siblingProjectId],
    );
    await pool.query(
      `INSERT INTO releases (id, organization_id, project_id, version)
       VALUES ($1, $2, $3, 'shared-version'),
              ($4, $2, $5, 'shared-version'),
              ($6, $2, $5, 'sibling-only')`,
      [
        primaryReleaseId,
        organizationId,
        projectId,
        siblingReleaseId,
        siblingProjectId,
        siblingOnlyReleaseId,
      ],
    );
    await pool.query(
      `INSERT INTO release_artifacts (
         id, organization_id, project_id, release_id, name, size, checksum, storage_key
       ) VALUES ($1, $2, $3, $4, 'sibling.js.map', 1, 'checksum', 'rbac/sibling.map')`,
      [siblingArtifactId, organizationId, siblingProjectId, siblingReleaseId],
    );
    await pool.query(
      `UPDATE organization_roles SET permissions = '[]'::jsonb
       WHERE organization_id = $1 AND key = 'viewer'`,
      [organizationId],
    );

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DELETE FROM audit_logs WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM ticket_trackers WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM alert_deliveries WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM alert_rules WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM autofix_runs WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM events WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM issues WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM invitations WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM project_keys WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM project_saved_searches WHERE organization_id = $1`, [
        organizationId,
      ]);
      await pool.query(`DELETE FROM release_artifacts WHERE organization_id = $1`, [
        organizationId,
      ]);
      await pool.query(`DELETE FROM releases WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM projects WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM team_members WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM team_roles WHERE organization_id = $1`, [organizationId]);
      await pool.query(`DELETE FROM teams WHERE organization_id = ANY($1::uuid[])`, [
        [organizationId, otherOrganizationId],
      ]);
      await pool.query(`DELETE FROM organization_members WHERE organization_id = $1`, [
        organizationId,
      ]);
      await pool.query(`DELETE FROM organization_roles WHERE organization_id = $1`, [
        organizationId,
      ]);
      await pool.query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [
        [organizationId, otherOrganizationId],
      ]);
      await pool.query(`DELETE FROM personal_access_tokens WHERE user_id = ANY($1::uuid[])`, [
        userIds,
      ]);
      for (const [table, column] of [
        ["session", "user_id"],
        ["account", "user_id"],
        ["twoFactor", "userId"],
        ["user", "id"],
        ["issue_comments", "user_id"],
      ]) {
        await pool.query(`DELETE FROM "${table}" WHERE "${column}" = ANY($1::uuid[])`, [userIds]);
      }
      await pool.query(
        "DELETE FROM verification WHERE value = ANY($1::text[]) OR identifier = ANY($2::text[])",
        [userIds, userIds.map((id) => `2fa-attempts-2fa-${id}`)],
      );
      await pool.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [userIds]);
    }
    if (app) await app.close();
  });

  it.each(systemRoles)("allows the %s role to read its organization", async (role) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}`,
      headers: authorization(role),
    });
    expect(response.statusCode).toBe(200);
  });

  it("synchronizes stale system-role permissions when roles are listed", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/roles`,
      headers: authorization("owner"),
    });
    expect(response.statusCode).toBe(200);
    const viewer = response.json().find((role: { key: string }) => role.key === "viewer");
    expect(viewer.permissions).toEqual(ROLE_PERMISSIONS.viewer);
  });

  it.each([
    ["owner", 200],
    ["admin", 200],
    ["manager", 200],
    ["developer", 403],
    ["member", 200],
    ["viewer", 403],
  ] as const)("enforces member listing for %s", async (role, statusCode) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/members`,
      headers: authorization(role),
    });
    expect(response.statusCode).toBe(statusCode);
  });

  it.each(systemRoles)(
    "applies organization project.read globally for the %s role",
    async (role) => {
      const response = await app.inject({
        method: "GET",
        url: `/api/organizations/${organizationSlug}/projects/${projectSlug}`,
        headers: authorization(role),
      });
      expect(response.statusCode).toBe(200);
    },
  );

  it.each([
    ["owner", 200],
    ["admin", 200],
    ["manager", 200],
    ["developer", 403],
    ["member", 403],
    ["viewer", 403],
  ] as const)("enforces project key visibility for %s", async (role, statusCode) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/keys`,
      headers: authorization(role),
    });
    expect(response.statusCode).toBe(statusCode);
  });

  it("grants project permissions through the scoped team role", async () => {
    for (const path of [
      `/api/organizations/${organizationSlug}/projects/${projectSlug}`,
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/keys`,
    ]) {
      const response = await app.inject({
        method: "GET",
        url: path,
        headers: authorization("team-user"),
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it("denies the same scoped permissions without team membership", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/projects/${projectSlug}`,
      headers: authorization("outsider"),
    });
    expect(response.statusCode).toBe(403);
  });

  it("lists team projects only when the team role grants view_projects", async () => {
    const visible = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/projects`,
      headers: authorization("team-user"),
    });
    expect(visible.statusCode).toBe(200);
    expect(visible.json()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectId })]),
    );

    const hidden = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/projects`,
      headers: authorization("outsider"),
    });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: projectId })]),
    );
  });

  it("grants custom organization project permissions without team membership", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/keys`,
      headers: authorization("global-custom"),
    });
    expect(response.statusCode).toBe(200);
  });

  it.each([
    ["manager", "alerts", 200],
    ["viewer", "alerts", 403],
    ["viewer", "releases", 200],
    ["viewer", "integrations/repo-connection", 404],
    ["viewer", "autofix/config", 200],
    ["manager", "audit", 200],
    ["viewer", "audit", 403],
  ] as const)("enforces feature permission for %s on %s", async (role, suffixPath, statusCode) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/${suffixPath}`,
      headers: authorization(role),
    });
    expect(response.statusCode).toBe(statusCode);
  });

  it("hides organizations across tenant boundaries", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/organizations/${otherOrganizationSlug}`,
      headers: authorization("viewer"),
    });
    expect(response.statusCode).toBe(404);
  });

  it("never resolves issue, event, or autofix identifiers through another project", async () => {
    const cases = [
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/issues/${siblingIssueId}`,
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/events/${siblingEventId}`,
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/issues/${siblingIssueId}/autofix/runs`,
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/autofix/runs/${siblingAutofixRunId}`,
    ];

    for (const url of cases) {
      const response = await app.inject({ method: "GET", url, headers: authorization("owner") });
      expect(response.statusCode).toBe(404);
    }

    for (const url of [
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/issues/${issueId}`,
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/events/${eventId}`,
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/issues/${issueId}/autofix/runs`,
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/autofix/runs/${autofixRunId}`,
    ]) {
      const response = await app.inject({ method: "GET", url, headers: authorization("owner") });
      expect(response.statusCode).toBe(200);
    }
  });

  it("does not trigger autofix for an issue belonging to another project", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/issues/${siblingIssueId}/autofix`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: {},
    });
    expect(response.statusCode).toBe(404);
  });

  it("generates a fix only for an analyzed run of the same project", async () => {
    const fixUrl = (runId: string) =>
      `/api/organizations/${organizationSlug}/projects/${projectSlug}/autofix/runs/${runId}/fix`;
    const post = (runId: string, role: string) =>
      app.inject({
        method: "POST",
        url: fixUrl(runId),
        headers: { ...authorization(role), "content-type": "application/json" },
        payload: {},
      });

    expect((await post(siblingAutofixRunId, "owner")).statusCode).toBe(404);
    expect((await post(autofixRunId, "viewer")).statusCode).toBe(403);
    // The fixture run is queued, not analyzed.
    const response = await post(autofixRunId, "owner");
    expect(response.statusCode).toBe(409);
    expect(response.json().message).toBe("Only an analyzed run can generate a fix.");
  });

  it("creates a release once under concurrent CI jobs and records its commit", async () => {
    const releaseUrl = `/api/organizations/${organizationSlug}/projects/${projectSlug}/releases/ci-${suffix}`;
    const put = (payload?: Record<string, unknown>) =>
      app.inject({
        method: "PUT",
        url: releaseUrl,
        headers: {
          ...authorization("owner"),
          ...(payload ? { "content-type": "application/json" } : {}),
        },
        ...(payload ? { payload } : {}),
      });

    const responses = await Promise.all(Array.from({ length: 5 }, () => put()));
    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(responses.map((response) => response.json().id)).size).toBe(1);

    expect((await put({ commitSha: "not-a-sha" })).statusCode).toBe(400);
    const withCommit = await put({ commitSha: "ABCDEF1234567890ABCDEF1234567890ABCDEF12" });
    expect(withCommit.statusCode).toBe(200);
    expect(withCommit.json()).toMatchObject({
      commitSha: "abcdef1234567890abcdef1234567890abcdef12",
      commitsStatus: "pending",
    });

    const sync = await app.inject({
      method: "POST",
      url: `${releaseUrl}/commits/sync`,
      headers: { ...authorization("viewer"), "content-type": "application/json" },
      payload: {},
    });
    expect(sync.statusCode).toBe(403);
    const commits = await app.inject({
      method: "GET",
      url: `${releaseUrl}/commits`,
      headers: authorization("viewer"),
    });
    expect(commits.statusCode).toBe(200);
    // A running worker may already have found that no repository is connected.
    expect(["pending", "unavailable"]).toContain(commits.json().status);
    expect(commits.json().commits).toEqual([]);
  });

  it("keeps ticket trackers and tickets inside their project and role", async () => {
    const base = `/api/organizations/${organizationSlug}/projects/${projectSlug}`;
    const siblingTrackerId = randomUUID();
    await pool.query(
      `INSERT INTO ticket_trackers (id, organization_id, project_id, provider, name, config)
       VALUES ($1, $2, $3, 'github', 'Sibling GitHub', '{"provider":"github","repository":null}'::jsonb)`,
      [siblingTrackerId, organizationId, siblingProjectId],
    );
    const inject = (
      method: "GET" | "POST" | "DELETE",
      url: string,
      role: string,
      payload?: Record<string, unknown>,
    ) =>
      app.inject({
        method,
        url: `${base}${url}`,
        headers: {
          ...authorization(role),
          ...(payload ? { "content-type": "application/json" } : {}),
        },
        ...(payload ? { payload } : {}),
      });

    const list = await inject("GET", `/issues/${issueId}/tickets`, "viewer");
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({ tickets: [], trackers: [] });

    expect(
      (await inject("POST", "/ticket-trackers", "viewer", { provider: "github", name: "GitHub" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await inject("POST", `/issues/${issueId}/tickets`, "viewer", {
          trackerId: siblingTrackerId,
        })
      ).statusCode,
    ).toBe(403);

    const foreignTracker = await inject("POST", `/issues/${issueId}/tickets`, "owner", {
      trackerId: siblingTrackerId,
    });
    expect(foreignTracker.statusCode).toBe(404);
    expect(foreignTracker.json().message).toBe("Tracker not found");
    expect((await inject("GET", `/issues/${siblingIssueId}/tickets`, "owner")).statusCode).toBe(
      404,
    );
    expect(
      (await inject("DELETE", `/ticket-trackers/${siblingTrackerId}`, "owner")).statusCode,
    ).toBe(404);

    const withoutRepository = await inject("POST", "/ticket-trackers", "owner", {
      provider: "github",
      name: "GitHub",
    });
    expect(withoutRepository.statusCode).toBe(400);
    expect(withoutRepository.json().message).toContain("Connect a GitHub repository");
  });

  it("never reads commits or suspects through another project", async () => {
    const base = `/api/organizations/${organizationSlug}/projects/${projectSlug}`;
    for (const url of [
      `${base}/releases/sibling-only/commits`,
      `${base}/issues/${siblingIssueId}/suspect-commits`,
    ]) {
      const response = await app.inject({ method: "GET", url, headers: authorization("owner") });
      expect(response.statusCode).toBe(404);
    }
  });

  it("rejects foreign resource ids across saved searches, keys, alerts, releases and artifacts", async () => {
    const cases: Array<{
      method: "GET" | "PATCH" | "DELETE";
      url: string;
      payload?: Record<string, unknown>;
    }> = [
      {
        method: "DELETE",
        url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/saved-searches/${siblingSavedSearchId}`,
      },
      {
        method: "PATCH",
        url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/keys/${siblingProjectKeyId}`,
        payload: { isActive: false },
      },
      {
        method: "PATCH",
        url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/alerts/${siblingAlertRuleId}`,
        payload: { name: "Cross-project update" },
      },
      {
        method: "GET",
        url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/releases/sibling-only`,
      },
      {
        method: "DELETE",
        url: `/api/organizations/${organizationSlug}/projects/${projectSlug}/releases/shared-version/artifacts/${siblingArtifactId}`,
      },
    ];

    for (const testCase of cases) {
      const response = await app.inject({
        ...testCase,
        headers: {
          ...authorization("owner"),
          ...(testCase.payload ? { "content-type": "application/json" } : {}),
        },
      });
      expect(response.statusCode).toBe(404);
    }
  });

  it("prevents managers from changing or assigning roles at or above their level", async () => {
    const demoteAdmin = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/members/${memberIds.get("admin")}`,
      headers: { ...authorization("manager"), "content-type": "application/json" },
      payload: { role: "viewer" },
    });
    expect(demoteAdmin.statusCode).toBe(403);

    const promoteViewer = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/members/${memberIds.get("viewer")}`,
      headers: { ...authorization("manager"), "content-type": "application/json" },
      payload: { role: "admin" },
    });
    expect(promoteViewer.statusCode).toBe(403);
  });

  it("prevents non-owners from assigning an equivalent role", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/members/${memberIds.get("viewer")}`,
      headers: { ...authorization("admin"), "content-type": "application/json" },
      payload: { role: "admin" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("allows an owner to delegate roles but never remove the last owner", async () => {
    const assign = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/members/${memberIds.get("viewer")}`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { role: "admin" },
    });
    expect(assign.statusCode).toBe(200);

    const lastOwner = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/members/${memberIds.get("owner")}`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { role: "admin" },
    });
    expect(lastOwner.statusCode).toBe(403);
  });

  it("serializes concurrent owner demotions and always preserves one owner", async () => {
    await createUser("owner-two", "owner");
    const requests = [
      app.inject({
        method: "PATCH",
        url: `/api/organizations/${organizationSlug}/members/${memberIds.get("owner-two")}`,
        headers: { ...authorization("owner"), "content-type": "application/json" },
        payload: { role: "admin" },
      }),
      app.inject({
        method: "PATCH",
        url: `/api/organizations/${organizationSlug}/members/${memberIds.get("owner")}`,
        headers: { ...authorization("owner-two"), "content-type": "application/json" },
        payload: { role: "admin" },
      }),
    ];
    const responses = await Promise.all(requests);
    expect(responses.map(({ statusCode }) => statusCode).sort((a, b) => a - b)).toEqual([200, 403]);

    const owners = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM organization_members
       WHERE organization_id = $1 AND role = 'owner'`,
      [organizationId],
    );
    expect(owners.rows[0]?.count).toBe("1");

    await pool.query(
      `UPDATE organization_members SET role = CASE WHEN id = $2 THEN 'owner' ELSE 'admin' END
       WHERE organization_id = $1 AND id = ANY($3::uuid[])`,
      [
        organizationId,
        memberIds.get("owner"),
        [memberIds.get("owner"), memberIds.get("owner-two")],
      ],
    );
  });

  it("accepts a concurrent invitation exactly once", async () => {
    await createUser("invitee");
    const invitation = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { email: `invitee-${suffix}@example.test`, role: "viewer" },
    });
    expect(invitation.statusCode).toBe(201);
    const token = invitation.json().token as string;

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        app.inject({
          method: "POST",
          url: "/api/organizations/invitations/accept",
          headers: { ...authorization("invitee"), "content-type": "application/json" },
          payload: { token },
        }),
      ),
    );
    expect(responses.map(({ statusCode }) => statusCode).sort((a, b) => a - b)).toEqual([201, 404]);

    const memberships = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userIdByLabel.get("invitee")],
    );
    expect(memberships.rows[0]?.count).toBe("1");
  });

  it("prevents invitation-based role escalation", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: { ...authorization("manager"), "content-type": "application/json" },
      payload: { email: `invite-${suffix}@example.test`, role: "owner" },
    });
    expect(response.statusCode).toBe(403);
  });

  it("prevents custom roles at the actor's own privilege level", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/roles`,
      headers: { ...authorization("admin"), "content-type": "application/json" },
      payload: {
        key: adminCopyRoleKey,
        name: "Admin copy",
        permissions: ROLE_PERMISSIONS.admin,
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it("protects custom role lifecycle rules and pending invitations", async () => {
    const create = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/roles`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { key: customRoleKey, name: "Limited", permissions: ["org.read"] },
    });
    expect(create.statusCode).toBe(201);

    const update = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/roles/${customRoleKey}`,
      headers: { ...authorization("admin"), "content-type": "application/json" },
      payload: { name: "Limited updated", permissions: ["org.read", "org.members.read"] },
    });
    expect(update.statusCode).toBe(200);

    const updateSystem = await app.inject({
      method: "PATCH",
      url: `/api/organizations/${organizationSlug}/roles/viewer`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { name: "Changed", permissions: ["org.read"] },
    });
    expect(updateSystem.statusCode).toBe(409);

    const invite = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { email: `limited-${suffix}@example.test`, role: customRoleKey },
    });
    expect(invite.statusCode).toBe(201);

    const deleteInvitedRole = await app.inject({
      method: "DELETE",
      url: `/api/organizations/${organizationSlug}/roles/${customRoleKey}`,
      headers: authorization("owner"),
    });
    expect(deleteInvitedRole.statusCode).toBe(409);
  });

  it("revokes pending invitations within the organization and invalidates their links", async () => {
    await createUser("revoke-viewer", "viewer");
    const invite = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: authorization("owner"),
      payload: { email: `non-member-${suffix}@example.test`, role: "viewer" },
    });
    expect(invite.statusCode).toBe(201);
    const { invitation, token } = invite.json();
    const url = `/api/organizations/${organizationSlug}/invitations/${invitation.id}`;
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("revoke-viewer") }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/organizations/${otherOrganizationSlug}/invitations/${invitation.id}`,
          headers: authorization("owner"),
        })
      ).statusCode,
    ).toBe(404);
    const revoke = await app.inject({ method: "DELETE", url, headers: authorization("owner") });
    expect(revoke.statusCode).toBe(200);
    expect(revoke.json()).toEqual({ success: true });
    const pending = await app.inject({
      method: "GET",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: authorization("owner"),
    });
    expect(pending.json().map((item: { id: string }) => item.id)).not.toContain(invitation.id);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/organizations/invitations/accept",
          headers: authorization("non-member"),
          payload: { token },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "POST", url: `${url}/resend`, headers: authorization("owner") }))
        .statusCode,
    ).toBe(404);
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("owner") })).statusCode,
    ).toBe(404);
  });

  it("prevents an admin from revoking an owner invitation", async () => {
    const invite = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: authorization("owner"),
      payload: { email: `owner-invite-${suffix}@example.test`, role: "owner" },
    });
    expect(invite.statusCode).toBe(201);
    const url = `/api/organizations/${organizationSlug}/invitations/${invite.json().invitation.id}`;
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("admin") })).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("owner") })).statusCode,
    ).toBe(200);
  });

  it("removes an accepted invitee through membership removal while preserving their account", async () => {
    await createUser("accepted-invitee");
    const invite = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: authorization("owner"),
      payload: { email: `accepted-invitee-${suffix}@example.test`, role: "viewer" },
    });
    expect(invite.statusCode).toBe(201);
    const { invitation, token } = invite.json();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/organizations/invitations/accept",
          headers: authorization("accepted-invitee"),
          payload: { token },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/organizations/${organizationSlug}/invitations/${invitation.id}`,
          headers: authorization("owner"),
        })
      ).statusCode,
    ).toBe(404);
    const member = await pool.query(
      "SELECT id FROM organization_members WHERE organization_id = $1 AND user_id = $2",
      [organizationId, userIdByLabel.get("accepted-invitee")],
    );
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/organizations/${organizationSlug}/members/${member.rows[0].id}`,
          headers: authorization("owner"),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/organizations/${organizationSlug}`,
          headers: authorization("accepted-invitee"),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await pool.query("SELECT id FROM users WHERE id = $1", [
          userIdByLabel.get("accepted-invitee"),
        ])
      ).rowCount,
    ).toBe(1);
  });

  it("enforces the database role-key length before persistence", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/roles`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { key: "a".repeat(33), name: "Too long", permissions: ["org.read"] },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects obsolete or unknown permissions", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/roles`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: {
        key: `invalid-${suffix}`,
        name: "Invalid",
        permissions: ["org.delete"],
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("does not add non-organization users to teams", async () => {
    const nonMemberUserId = userIdByLabel.get("non-member")!;
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/teams/${teamSlug}/members`,
      headers: { ...authorization("manager"), "content-type": "application/json" },
      payload: { userId: nonMemberUserId, role: "viewer" },
    });
    expect(response.statusCode).toBe(404);
  });

  it("does not assign a project to a team from another organization", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/projects`,
      headers: { ...authorization("manager"), "content-type": "application/json" },
      payload: { name: `Cross tenant ${suffix}`, teamId: otherTeamId },
    });
    expect(response.statusCode).toBe(400);
  });

  it("audits the complete team and role mutation lifecycle", async () => {
    const slug = `audit-team-${suffix}`;
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/organizations/${organizationSlug}/teams`,
          headers: { ...authorization("owner"), "content-type": "application/json" },
          payload: { name: "Audit team", slug },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/organizations/${organizationSlug}/teams/${slug}`,
          headers: { ...authorization("owner"), "content-type": "application/json" },
          payload: { name: "Audit team updated" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/organizations/${organizationSlug}/teams/${slug}/roles`,
          headers: { ...authorization("owner"), "content-type": "application/json" },
          payload: { name: "Audit custom", permissions: ["view_projects"] },
        })
      ).statusCode,
    ).toBe(201);
    const targetUserId = userIdByLabel.get("viewer")!;
    expect(
      (
        await app.inject({
          method: "POST",
          url: `/api/organizations/${organizationSlug}/teams/${slug}/members`,
          headers: { ...authorization("owner"), "content-type": "application/json" },
          payload: { userId: targetUserId, role: "audit-custom" },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/organizations/${organizationSlug}/teams/${slug}/members/${targetUserId}`,
          headers: authorization("owner"),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/organizations/${organizationSlug}/teams/${slug}/roles/audit-custom`,
          headers: authorization("owner"),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/organizations/${organizationSlug}/teams/${slug}`,
          headers: authorization("owner"),
        })
      ).statusCode,
    ).toBe(200);

    const audit = await pool.query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE organization_id = $1`,
      [organizationId],
    );
    expect(audit.rows.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        "team.created",
        "team.updated",
        "team.role.created",
        "team.member.added",
        "team.member.removed",
        "team.role.deleted",
        "team.deleted",
        "organization.role.created",
        "organization.invitation.created",
        "organization.member.role_updated",
      ]),
    );
  });

  it("enforces instance super-admin authorization independently from organization roles", async () => {
    const ownerResponse = await app.inject({
      method: "GET",
      url: "/api/instance-admin/settings",
      headers: authorization("owner"),
    });
    expect(ownerResponse.statusCode).toBe(200);

    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/instance-admin/settings",
      headers: authorization("admin"),
    });
    expect(adminResponse.statusCode).toBe(403);
  });

  it("allows only instance admins to manually verify SMTP without saving settings", async () => {
    const before = await app.inject({
      method: "GET",
      url: "/api/instance-admin/settings",
      headers: authorization("owner"),
    });
    const payload = {
      smtpHost: process.env.E2E_SMTP_HOST ?? "localhost",
      smtpPort: Number(process.env.E2E_SMTP_PORT ?? 1025),
      smtpSecure: false,
    };
    const denied = await app.inject({
      method: "POST",
      url: "/api/instance-admin/smtp/test",
      headers: authorization("admin"),
      payload,
    });
    expect(denied.statusCode).toBe(403);
    const tested = await app.inject({
      method: "POST",
      url: "/api/instance-admin/smtp/test",
      headers: authorization("owner"),
      payload,
    });
    expect(tested.statusCode).toBe(201);
    expect(tested.json()).toEqual({ success: true });
    const after = await app.inject({
      method: "GET",
      url: "/api/instance-admin/settings",
      headers: authorization("owner"),
    });
    expect(after.json()).toEqual(before.json());
  });

  it("deletes Better Auth and application user data, invalidates credentials, and frees the email", async () => {
    const email = `delete-user-${suffix}@example.test`;
    const invite = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: authorization("owner"),
      payload: { email, role: "viewer" },
    });
    expect(invite.statusCode).toBe(201);
    const signup = (token: string) =>
      handleBetterAuthRequest(
        new Request(
          `${process.env.BETTER_AUTH_URL ?? "http://localhost:3002/api/better-auth"}/sign-up/email`,
          {
            method: "POST",
            headers: { "content-type": "application/json", "x-invitation-token": token },
            body: JSON.stringify({ email, password: "DeleteUserPassword42!", name: "Delete me" }),
          },
        ),
      );
    const registered = await signup(invite.json().token);
    expect(registered.status).toBe(200);
    const registeredBody = await registered.json();
    const targetId = registeredBody.user.id as string;
    userIds.push(targetId);
    const cookie = registered.headers
      .getSetCookie()
      .map((entry) => entry.split(";")[0])
      .join("; ");
    expect(await getBetterAuthSession(new Headers({ cookie }))).not.toBeNull();
    const pat = `pat_delete_${randomUUID()}`;
    await pool.query(
      "INSERT INTO personal_access_tokens (user_id, name, token_hash, token_preview) VALUES ($1, 'delete', $2, 'delete')",
      [targetId, hashOpaqueToken(pat)],
    );
    await pool.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'viewer')",
      [organizationId, targetId],
    );
    await pool.query(
      "INSERT INTO team_members (organization_id, team_id, user_id, role) VALUES ($1, $2, $3, 'viewer')",
      [organizationId, teamId, targetId],
    );
    await pool.query(
      `INSERT INTO "twoFactor" (secret, "backupCodes", "userId") VALUES ('secret', 'backup', $1)`,
      [targetId],
    );
    await pool.query(
      "INSERT INTO verification (identifier, value, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour'), ($3, '0', NOW() + INTERVAL '1 hour')",
      [`2fa-${targetId}`, targetId, `2fa-attempts-2fa-${targetId}`],
    );
    await pool.query(
      "INSERT INTO project_saved_searches (organization_id, project_id, user_id, name) VALUES ($1, $2, $3, 'private')",
      [organizationId, projectId, targetId],
    );
    await pool.query(
      "INSERT INTO issue_comments (organization_id, project_id, issue_id, user_id, body) VALUES ($1, $2, $3, $4, 'private comment')",
      [organizationId, projectId, issueId, targetId],
    );
    await pool.query("UPDATE issues SET assigned_user_id = $1 WHERE id = $2", [targetId, issueId]);
    const url = `/api/instance-admin/users/${targetId}`;
    const payload = { confirmationEmail: email };
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("admin"), payload }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url,
          headers: authorization("owner"),
          payload: { confirmationEmail: "wrong" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("owner"), payload }))
        .statusCode,
    ).toBe(200);
    for (const [table, column] of [
      ["users", "id"],
      ["user", "id"],
      ["session", "user_id"],
      ["account", "user_id"],
      ["twoFactor", "userId"],
      ["personal_access_tokens", "user_id"],
      ["organization_members", "user_id"],
      ["team_members", "user_id"],
      ["project_saved_searches", "user_id"],
      ["issue_comments", "user_id"],
    ]) {
      expect(
        (await pool.query(`SELECT 1 FROM "${table}" WHERE "${column}" = $1`, [targetId])).rowCount,
      ).toBe(0);
    }
    expect(
      (
        await pool.query("SELECT 1 FROM verification WHERE value = $1 OR identifier = $2", [
          targetId,
          `2fa-attempts-2fa-${targetId}`,
        ])
      ).rowCount,
    ).toBe(0);
    expect((await pool.query("SELECT 1 FROM invitations WHERE email = $1", [email])).rowCount).toBe(
      0,
    );
    expect(
      (await pool.query("SELECT assigned_user_id FROM issues WHERE id = $1", [issueId])).rows[0]
        .assigned_user_id,
    ).toBeNull();
    expect(await getBetterAuthSession(new Headers({ cookie }))).toBeNull();
    expect(
      (
        await app.inject({
          method: "GET",
          url: "/api/auth/me",
          headers: { authorization: `Bearer ${pat}` },
        })
      ).statusCode,
    ).toBe(401);
    const reinvite = await app.inject({
      method: "POST",
      url: `/api/organizations/${organizationSlug}/invitations`,
      headers: authorization("owner"),
      payload: { email, role: "viewer" },
    });
    const recreated = await signup(reinvite.json().token);
    expect(recreated.status).toBe(200);
    const newId = (await recreated.json()).user.id;
    userIds.push(newId);
    expect(newId).not.toBe(targetId);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/instance-admin/users/${newId}`,
          headers: authorization("owner"),
          payload,
        })
      ).statusCode,
    ).toBe(200);
  });

  it("protects self-deletion and sole organization owners before deleting anything", async () => {
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/instance-admin/users/${userIdByLabel.get("owner")}`,
          headers: authorization("owner"),
          payload: { confirmationEmail: `owner-${suffix}@example.test` },
        })
      ).statusCode,
    ).toBe(403);
    await createUser("deletable-owner", "owner");
    const targetId = userIdByLabel.get("deletable-owner")!;
    await pool.query("UPDATE organizations SET owner_user_id = $1 WHERE id = $2", [
      targetId,
      otherOrganizationId,
    ]);
    const url = `/api/instance-admin/users/${targetId}`;
    const payload = { confirmationEmail: `deletable-owner-${suffix}@example.test` };
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("owner"), payload }))
        .statusCode,
    ).toBe(409);
    expect((await pool.query("SELECT 1 FROM users WHERE id = $1", [targetId])).rowCount).toBe(1);
    await pool.query("UPDATE organizations SET owner_user_id = $1 WHERE id = $2", [
      userIdByLabel.get("owner"),
      otherOrganizationId,
    ]);
    await pool.query("UPDATE organizations SET owner_user_id = $1 WHERE id = $2", [
      targetId,
      organizationId,
    ]);
    expect(
      (await app.inject({ method: "DELETE", url, headers: authorization("owner"), payload }))
        .statusCode,
    ).toBe(200);
    expect(
      (await pool.query("SELECT owner_user_id FROM organizations WHERE id = $1", [organizationId]))
        .rows[0].owner_user_id,
    ).toBe(userIdByLabel.get("owner"));
  });

  it("serializes concurrent super-admin demotions", async () => {
    const secondAdminId = userIdByLabel.get("owner-two")!;
    await pool.query(`UPDATE users SET is_super_admin = true WHERE id = $1`, [secondAdminId]);

    const responses = await Promise.all([
      app.inject({
        method: "PATCH",
        url: `/api/instance-admin/users/${secondAdminId}`,
        headers: { ...authorization("owner"), "content-type": "application/json" },
        payload: { isSuperAdmin: false },
      }),
      app.inject({
        method: "PATCH",
        url: `/api/instance-admin/users/${userIdByLabel.get("owner")}`,
        headers: { ...authorization("owner-two"), "content-type": "application/json" },
        payload: { isSuperAdmin: false },
      }),
    ]);
    expect(responses.map(({ statusCode }) => statusCode).sort((a, b) => a - b)).toEqual([200, 403]);

    const admins = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE is_super_admin = true`,
    );
    expect(Number(admins.rows[0]?.count)).toBeGreaterThanOrEqual(1);
    await pool.query(
      `UPDATE users SET is_super_admin = CASE WHEN id = $1 THEN true ELSE false END
       WHERE id = ANY($2::uuid[])`,
      [userIdByLabel.get("owner"), [userIdByLabel.get("owner"), secondAdminId]],
    );
  });

  it("protects the final super-admin and rejects unknown admin targets", async () => {
    const otherSuperAdmins = await pool.query<{ id: string }>(
      `UPDATE users SET is_super_admin = false
       WHERE is_super_admin = true AND id <> $1
       RETURNING id`,
      [userIdByLabel.get("owner")],
    );
    const lastAdmin = await app.inject({
      method: "PATCH",
      url: `/api/instance-admin/users/${userIdByLabel.get("owner")}`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { isSuperAdmin: false },
    });
    if (otherSuperAdmins.rows.length > 0) {
      await pool.query(`UPDATE users SET is_super_admin = true WHERE id = ANY($1::uuid[])`, [
        otherSuperAdmins.rows.map(({ id }) => id),
      ]);
    }
    expect(lastAdmin.statusCode).toBe(403);

    const missingTarget = await app.inject({
      method: "PATCH",
      url: `/api/instance-admin/users/${randomUUID()}`,
      headers: { ...authorization("owner"), "content-type": "application/json" },
      payload: { isSuperAdmin: true },
    });
    expect(missingTarget.statusCode).toBe(404);
  });
});
