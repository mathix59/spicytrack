import { createHmac, randomUUID } from "node:crypto";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Pool } from "pg";
import { AppModule } from "../src/app.module";
import { hashOpaqueToken } from "../src/common/tokens";
import { DATABASE_POOL } from "../src/database/database.provider";

const SLACK = "http://slack.e2e.test";

describe("Slack app interactions (e2e)", () => {
  let app: NestFastifyApplication;
  let pool: Pool;
  const realFetch = global.fetch;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const organizationId = randomUUID();
  const projectId = randomUUID();
  const issueId = randomUUID();
  const slackTeamId = `T${Math.random().toString(16).slice(2, 12).toUpperCase()}`;
  const signingSecret = "a".repeat(32);
  const userIds = new Map<string, string>();
  const tokens = new Map<string, string>();
  const responses: Array<Record<string, any>> = [];
  let grantedScopes = "incoming-webhook,users:read,users:read.email";

  const email = (label: string) => `slack-${label}-${suffix}@example.test`;

  async function createMember(label: string, role: string) {
    const userId = randomUUID();
    const token = `pat_slack_${label}_${randomUUID()}`;
    userIds.set(label, userId);
    tokens.set(label, token);
    await pool.query(`INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, '', $3)`, [
      userId,
      email(label),
      `Slack ${label}`,
    ]);
    await pool.query(
      `INSERT INTO personal_access_tokens (id, user_id, name, token_hash, token_preview)
       VALUES ($1, $2, 'Slack E2E', $3, $4)`,
      [randomUUID(), userId, hashOpaqueToken(token), token.slice(-12)],
    );
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role) VALUES ($1, $2, $3, $4)`,
      [randomUUID(), organizationId, userId, role],
    );
  }

  /** Stands in for the Slack Web API and the message response URL. */
  function fakeSlack(input: string | URL | Request, init?: RequestInit) {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith(SLACK)) return realFetch(input, init);
    const path = url.slice(SLACK.length);
    if (path === "/auth.test") {
      return Promise.resolve(
        new Response(JSON.stringify({ ok: true, team_id: slackTeamId, team: "Acme" }), {
          headers: { "x-oauth-scopes": grantedScopes },
        }),
      );
    }
    if (path === "/users.info") {
      const slackUser = new URLSearchParams(init?.body as string).get("user") ?? "";
      const profile = slackUser === "U_STRANGER" ? {} : { email: email(slackUser).toUpperCase() };
      return Promise.resolve(new Response(JSON.stringify({ ok: true, user: { profile } })));
    }
    if (path === "/respond") {
      responses.push(JSON.parse(init?.body as string));
      return Promise.resolve(new Response("ok"));
    }
    return Promise.resolve(new Response("not found", { status: 404 }));
  }

  function interaction(slackUser: string, action: string, secret = signingSecret) {
    const payload = {
      type: "block_actions",
      team: { id: slackTeamId },
      user: { id: slackUser },
      response_url: `${SLACK}/respond`,
      actions: [{ action_id: `spicytrack:${action}`, value: `${projectId}:${issueId}` }],
      message: {
        text: "New issue",
        blocks: [
          { type: "section", block_id: "head", text: { type: "mrkdwn", text: "Boom" } },
          {
            type: "actions",
            block_id: "spicytrack_actions",
            elements: [{ type: "button", action_id: "spicytrack:view", url: "https://st.test/i" }],
          },
        ],
      },
    };
    const body = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v0=${createHmac("sha256", secret)
      .update(`v0:${timestamp}:${body}`)
      .digest("hex")}`;
    return app.inject({
      method: "POST",
      url: "/api/slack/interactions",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signature,
      },
      payload: body,
    });
  }

  async function nextResponse() {
    const count = responses.length;
    for (let attempt = 0; attempt < 100 && responses.length === count; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return responses[count];
  }

  const settings = (method: "GET" | "PUT" | "DELETE", label: string, payload?: object) =>
    app.inject({
      method,
      url: `/api/organizations/slack-${suffix}/settings/slack`,
      headers: {
        authorization: `Bearer ${tokens.get(label)}`,
        ...(payload ? { "content-type": "application/json" } : {}),
      },
      ...(payload ? { payload } : {}),
    });

  beforeAll(async () => {
    process.env.SLACK_API_URL = SLACK;
    global.fetch = fakeSlack as typeof fetch;
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    pool = moduleFixture.get(DATABASE_POOL);

    const ownerId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, '', 'Slack owner')`,
      [ownerId, email("owner-user")],
    );
    await pool.query(
      `INSERT INTO organizations (id, name, slug, owner_user_id) VALUES ($1, 'Slack E2E', $2, $3)`,
      [organizationId, `slack-${suffix}`, ownerId],
    );
    await createMember("owner", "owner");
    await createMember("developer", "developer");
    await createMember("manager", "manager");
    await createMember("viewer", "viewer");
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, slug) VALUES ($1, $2, 'Slack Project', $3)`,
      [projectId, organizationId, `slack-project-${suffix}`],
    );
    await pool.query(
      `INSERT INTO issues (id, organization_id, project_id, grouping_key, title)
       VALUES ($1, $2, $3, $4, 'Slack issue')`,
      [issueId, organizationId, projectId, `slack-${suffix}`],
    );

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), {
      rawBody: true,
    });
    app.setGlobalPrefix("api");
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    global.fetch = realFetch;
    delete process.env.SLACK_API_URL;
    if (pool) {
      for (const table of [
        "organization_slack_settings",
        "audit_logs",
        "issue_activity",
        "issues",
        "projects",
        "organization_members",
      ]) {
        await pool.query(`DELETE FROM ${table} WHERE organization_id = $1`, [organizationId]);
      }
      await pool.query(`DELETE FROM organizations WHERE id = $1`, [organizationId]);
      await pool.query(`DELETE FROM personal_access_tokens WHERE user_id = ANY($1::uuid[])`, [
        [...userIds.values()],
      ]);
      await pool.query(`DELETE FROM users WHERE email LIKE $1`, [`slack-%-${suffix}@example.test`]);
    }
    await app?.close();
  });

  it("lets only organization managers connect the app, after checking its scopes", async () => {
    expect((await settings("GET", "viewer")).statusCode).toBe(403);
    expect((await settings("GET", "developer")).statusCode).toBe(403);
    expect((await settings("GET", "manager")).statusCode).toBe(403);
    const empty = await settings("GET", "owner");
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toMatchObject({ configured: false, teamId: null });
    expect(empty.json().requestUrl).toMatch(/\/api\/slack\/interactions$/);
    expect(JSON.parse(empty.json().manifest).oauth_config.scopes.bot).toContain("users:read.email");

    const body = { signingSecret, botToken: "xoxb-e2e" };
    expect((await settings("PUT", "viewer", body)).statusCode).toBe(403);
    expect((await settings("PUT", "owner", { ...body, signingSecret: "not hex" })).statusCode).toBe(
      400,
    );
    grantedScopes = "incoming-webhook";
    const missingScopes = await settings("PUT", "owner", body);
    expect(missingScopes.statusCode).toBe(422);
    expect(missingScopes.json().message).toContain("users:read, users:read.email scopes");

    grantedScopes = "incoming-webhook,users:read,users:read.email";
    const saved = await settings("PUT", "owner", body);
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ configured: true, teamId: slackTeamId, teamName: "Acme" });
    const stored = await pool.query(
      `SELECT signing_secret_ciphertext, bot_token_ciphertext FROM organization_slack_settings
       WHERE organization_id = $1`,
      [organizationId],
    );
    expect(JSON.stringify(stored.rows)).not.toContain("xoxb-e2e");
    expect(JSON.stringify(stored.rows)).not.toContain(signingSecret);
  });

  it("rejects interactions that Slack did not sign", async () => {
    const forged = await interaction("manager", "resolve", "b".repeat(32));
    expect(forged.statusCode).toBe(401);
    const unsigned = await app.inject({
      method: "POST",
      url: "/api/slack/interactions",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `payload=${encodeURIComponent(JSON.stringify({ team: { id: slackTeamId } }))}`,
    });
    expect(unsigned.statusCode).toBe(401);
    const status = await pool.query(`SELECT status FROM issues WHERE id = $1`, [issueId]);
    expect(status.rows[0].status).toBe("open");
  });

  it("acts as the matching member and refuses users who may not manage issues", async () => {
    for (const label of ["viewer", "developer"]) {
      expect((await interaction(label, "resolve")).statusCode).toBe(200);
      expect(await nextResponse()).toMatchObject({
        response_type: "ephemeral",
        replace_original: false,
        text: "You cannot manage issues in Slack Project.",
      });
    }

    expect((await interaction("U_STRANGER", "resolve")).statusCode).toBe(200);
    expect((await nextResponse()).text).toContain("could not read your Slack email");

    expect((await interaction("manager", "resolve")).statusCode).toBe(200);
    const resolved = await nextResponse();
    expect(resolved.replace_original).toBe(true);
    expect(resolved.blocks[0].block_id).toBe("head");
    expect(resolved.blocks[1].elements[0].text).toBe("Resolved by Slack manager in SpicyTrack");
    expect(
      resolved.blocks[2].elements.map((element: { action_id: string }) => element.action_id),
    ).toEqual(["spicytrack:view", "spicytrack:reopen", "spicytrack:assign_me"]);

    expect((await interaction("manager", "assign_me")).statusCode).toBe(200);
    await nextResponse();
    const issue = await pool.query(`SELECT status, assigned_user_id FROM issues WHERE id = $1`, [
      issueId,
    ]);
    expect(issue.rows[0]).toEqual({
      status: "resolved",
      assigned_user_id: userIds.get("manager"),
    });
    const activity = await pool.query(
      `SELECT type, actor_user_id FROM issue_activity WHERE issue_id = $1 ORDER BY created_at`,
      [issueId],
    );
    expect(activity.rows.every((row) => row.actor_user_id === userIds.get("manager"))).toBe(true);
    expect(activity.rows.length).toBeGreaterThanOrEqual(2);
  });

  it("ignores clicks on the link button", async () => {
    const before = responses.length;
    expect((await interaction("manager", "view")).statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(responses).toHaveLength(before);
  });
});
