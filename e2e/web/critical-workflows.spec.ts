import { expect, test, type APIRequestContext, type Cookie, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:58025";
const email = "owner@spicytrack.local";
const password = "Sup3rSecret!42";
const organizationName = "E2E Company";
const orgSlug = "e2e-company";
const projectName = "Checkout API";
const projectSlug = "checkout-api";
const ssoEmail = "sso-user@spicytrack.local";
const blockedSsoEmail = "blocked-user@spicytrack.local";
let organization = { name: organizationName, slug: orgSlug };
let ownerCookies: Cookie[] = [];

type MailpitMessage = { ID: string };
type Organization = { id: string; name: string; slug: string; role: string };
type Project = { id: string; publicId: number; slug: string; browserAllowedOrigins: string[] };
type ProjectKey = { id: string; publicKey: string };
type Issue = { id: string; title: string; status: string; isRegressed: boolean; timesSeen: number };
type Me = {
  user: { email: string; emailVerifiedAt: string | null };
  memberships: Array<{ slug: string; role: string }>;
};
type IssueDetail = { events: { items: Array<{ id: string }> } };
type EventDetail = {
  resolvedFrames?: Array<{ resolved: boolean; resolution: string; diagnostic: string }>;
};
type McpResponse = {
  result?: {
    content?: Array<{ text?: string }>;
    serverInfo?: { name?: string };
    tools?: Array<{ name: string }>;
  };
  error?: unknown;
};

test.describe.configure({ mode: "serial" });

async function verificationTokenFor(address: string) {
  let text = "";

  await expect
    .poll(
      async () => {
        const response = await fetch(
          `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
        );
        const payload = (await response.json()) as { messages?: MailpitMessage[] };
        const message = payload.messages?.[0];
        if (!message) return false;

        const detail = await fetch(`${mailpitUrl}/api/v1/message/${message.ID}`);
        text = ((await detail.json()) as { Text?: string }).Text ?? "";
        return text.includes("/verify-email?token=");
      },
      { timeout: 15_000, message: `verification email for ${address}` },
    )
    .toBe(true);

  const match = text.match(/\/verify-email\?token=([^\s]+)/);
  if (!match) throw new Error(`Verification token missing in email for ${address}`);
  return decodeURIComponent(match[1]);
}

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}

async function mcpRpc(request: APIRequestContext, token: string, body: Record<string, unknown>) {
  const response = await request.post("/api/mcp", {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    data: body,
  });
  const responseText = await response.text();
  const payload = response.headers()["content-type"]?.includes("text/event-stream")
    ? JSON.parse(
        responseText
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice("data: ".length) ?? "{}",
      )
    : JSON.parse(responseText || "{}");
  return { response, payload: payload as McpResponse };
}

async function sendError(
  request: APIRequestContext,
  project: Project,
  key: ProjectKey,
  eventId: string,
  release: string,
) {
  const response = await request.post(
    `/api/${project.publicId}/store/?sentry_key=${encodeURIComponent(key.publicKey)}`,
    {
      data: {
        event_id: eventId,
        timestamp: new Date().toISOString(),
        platform: "javascript",
        level: "error",
        environment: "production",
        release,
        message: "Checkout failed",
        culprit: "checkout.submitOrder",
        exception: {
          values: [{ type: "PaymentError", value: "Checkout failed" }],
        },
      },
    },
  );
  expect(response.ok(), await response.text()).toBe(true);
}

async function uploadArtifact(
  request: APIRequestContext,
  release: string,
  filename: string,
  sourceUrl: string,
) {
  const source = await fetch(sourceUrl);
  expect(source.ok).toBe(true);
  const response = await request.post(
    `/api/organizations/${organization.slug}/projects/${projectSlug}/releases/${encodeURIComponent(release)}/artifacts`,
    {
      multipart: {
        file: {
          name: filename,
          mimeType: filename.endsWith(".map") ? "application/json" : "application/javascript",
          buffer: Buffer.from(await source.arrayBuffer()),
        },
      },
    },
  );
  expect(response.ok(), await response.text()).toBe(true);
}

async function createOrganization(page: Page) {
  await page.goto("/app");
  const api = page.context().request;
  const organizations = await json<Organization[]>(await api.get("/api/organizations"));

  const existing = organizations.find((candidate) => candidate.slug === organization.slug);
  if (!existing) {
    const createResponse = await api.post("/api/organizations", {
      data: { name: organizationName, slug: organization.slug },
    });
    if (createResponse.status() === 409) {
      const suffix = String(Date.now()).slice(-6);
      organization.name = `${organizationName} ${suffix}`;
      organization.slug = `${orgSlug}-${suffix}`;
      const fallbackCreateResponse = await api.post("/api/organizations", {
        data: { name: organization.name, slug: organization.slug },
      });
      expect(fallbackCreateResponse.ok(), await fallbackCreateResponse.text()).toBe(true);
    } else {
      expect(createResponse.ok(), await createResponse.text()).toBe(true);
    }
  } else {
    organization.name = existing.name;
    organization.slug = existing.slug;
  }

  await expect(page.getByRole("link", { name: organization.name })).toBeVisible();
  await expect(page.getByRole("heading", { name: organization.name, exact: true })).toBeVisible();
}

async function signIn(page: Page) {
  if (ownerCookies.length > 0) {
    await page.context().addCookies(ownerCookies);
    await page.goto("/app");
    const signedInHeading = page.getByRole("heading", { name: "Organizations" });
    try {
      await signedInHeading.waitFor({ timeout: 3_000 });
      return;
    } catch {}
  }

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).first().click();
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();

  const organizationsHeading = page.getByRole("heading", { name: "Organizations" });
  const rateLimited = page.getByText("Too many requests. Please try again later.");
  await Promise.race([organizationsHeading.waitFor({ timeout: 15_000 }), rateLimited.waitFor({ timeout: 15_000 })]);
  if (await rateLimited.isVisible()) {
    await page.waitForTimeout(1_000);
    await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
    await organizationsHeading.waitFor({ timeout: 15_000 });
  }

  await expect(organizationsHeading).toBeVisible();
  ownerCookies = (await page.context().storageState()).cookies;
}

async function expectPageQuality(page: Page, name: string) {
  await expect(page.locator("main")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    targets: violation.nodes.map((node) => node.target.join(" ")),
    html: violation.nodes.map((node) => node.html),
  }));
  expect(violations, `${name} accessibility violations`).toEqual([]);
}

async function refreshOrganizationFromServer(page: Page) {
  const api = page.context().request;
  const organizations = await json<Organization[]>(await api.get("/api/organizations"));
  if (!organizations.length) return;

  const matchedOrganization =
    organizations.find((candidate) => candidate.slug === organization.slug) ??
    organizations.find((candidate) => candidate.name === organization.name) ??
    organizations.find((candidate) => candidate.name.startsWith(`${organizationName} `)) ??
    organizations.find((candidate) => candidate.slug.startsWith(`${orgSlug}-`)) ??
    organizations[0];

  organization.name = matchedOrganization.name;
  organization.slug = matchedOrganization.slug;
}

function primaryScreens(issue: Issue) {
  return [
    { name: "organizations", url: "/app", heading: "Organizations" },
    {
      name: "organization projects",
      url: `/orgs/${organization.slug}?tab=projects`,
      heading: organization.name,
    },
    {
      name: "organization members",
      url: `/orgs/${organization.slug}?tab=members`,
      heading: organization.name,
    },
    { name: "organization teams", url: `/orgs/${organization.slug}?tab=teams`, heading: organization.name },
    { name: "organization roles", url: `/orgs/${organization.slug}?tab=roles`, heading: organization.name },
    {
      name: "organization settings",
      url: `/orgs/${organization.slug}?tab=settings`,
      heading: organization.name,
    },
    {
      name: "project issues",
      url: `/orgs/${organization.slug}/projects/${projectSlug}?tab=observability`,
      heading: projectName,
    },
    {
      name: "project releases",
      url: `/orgs/${organization.slug}/projects/${projectSlug}?tab=inventory`,
      heading: projectName,
    },
    {
      name: "project alerts",
      url: `/orgs/${organization.slug}/projects/${projectSlug}?tab=alerting`,
      heading: projectName,
    },
    {
      name: "project keys",
      url: `/orgs/${organization.slug}/projects/${projectSlug}?tab=keys`,
      heading: projectName,
    },
    {
      name: "project integrations",
      url: `/orgs/${organization.slug}/projects/${projectSlug}?tab=integrations`,
      heading: projectName,
    },
    {
      name: "project audit",
      url: `/orgs/${organization.slug}/projects/${projectSlug}?tab=audit`,
      heading: projectName,
    },
    {
      name: "issue detail",
      url: `/orgs/${organization.slug}/projects/${projectSlug}/issues/${issue.id}`,
      heading: issue.title,
    },
    { name: "account", url: "/account", heading: "Account settings" },
    { name: "instance administration", url: "/admin", heading: "Instance administration" },
  ];
}

test("keeps public authentication and recovery screens accessible and responsive", async ({
  page,
}) => {
  const rootResponse = await page.request.get("/");
  expect(rootResponse.headers()["content-security-policy"]).toContain(
    "form-action 'self' https://github.com",
  );

  const screens = [
    { name: "sign in", url: "/", heading: "Sentry-compatible. Source available. Multi-tenant." },
    { name: "password reset", url: "/reset-password", heading: "Reset your password" },
    { name: "email verification", url: "/verify-email", heading: "Email verification" },
    {
      name: "invitation acceptance",
      url: "/invitations/accept",
      heading: "Sentry-compatible. Source available. Multi-tenant.",
    },
    { name: "two-factor authentication", url: "/two-factor", heading: "Two-factor verification" },
  ];

  for (const screen of screens) {
    await page.goto(screen.url);
    await expect(page.getByRole("heading", { exact: true, name: screen.heading })).toBeVisible();
    await expectPageQuality(page, screen.name);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { exact: true, name: screens[0].heading })).toBeVisible();
  await expectPageQuality(page, "mobile sign in");
});

test("validates the deployed error-tracking workflow", async ({ page }) => {
  await page.goto("/");

  const signUpResponse = await page.context().request.post("/api/better-auth/sign-up/email", {
    data: { name: "E2E Owner", email, password },
  });
  if (signUpResponse.status() === 200) {
    const token = await verificationTokenFor(email);
    await page.goto(`/verify-email?token=${encodeURIComponent(token)}`);
    await expect(page.getByText("Your email has been verified.")).toBeVisible();
    await page.getByRole("button", { name: "Back to the app" }).click();
    await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible({ timeout: 30_000 });
    ownerCookies = (await page.context().storageState()).cookies;
  } else {
    await signIn(page);
  }

  await createOrganization(page);

  await page.goto(`/orgs/${organization.slug}?tab=members`);
  await page.getByRole("button", { name: "Invite member" }).click();
  const invitationDialog = page.getByRole("dialog", { name: "Invite a member" });
  await invitationDialog.locator('input[name="email"]').fill(ssoEmail);
  await invitationDialog.locator('select[name="role"]').selectOption("member");
  await invitationDialog.getByRole("button", { name: "Send invite" }).click();
  await expect(page.getByText(ssoEmail, { exact: true })).toBeVisible();

  await page.goto(`/orgs/${organization.slug}?tab=teams`);
  await page.getByRole("button", { name: "New team" }).click();
  const teamDialog = page.getByRole("dialog", { name: "New team" });
  await teamDialog.locator('input[name="name"]').fill("Backend");
  await teamDialog.locator('input[name="description"]').fill("Owns the checkout API");
  await teamDialog.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByText("Backend")).toBeVisible();

  await page.goto(`/orgs/${organization.slug}?tab=projects`);
  await page.getByRole("button", { name: "New project" }).click();
  const projectDialog = page.getByRole("dialog", { name: "New project" });
  await projectDialog.locator('input[name="name"]').fill(projectName);
  await projectDialog.locator('select[name="platform"]').selectOption("javascript");
  await projectDialog.locator('select[name="teamId"]').selectOption({ label: "Backend" });
  await projectDialog.getByRole("button", { name: "Create project" }).click();

  const projectLink = page.getByRole("link", { name: projectName, exact: true });
  await Promise.race([
    projectLink.waitFor(),
    projectDialog.getByRole("alert").waitFor(),
  ]);
  if (await projectDialog.getByRole("alert").isVisible()) {
    await page.keyboard.press("Escape");
    await expect(projectDialog).toBeHidden();
  }
  await expect(projectLink).toBeVisible();

  const api = page.context().request;
  const projects = await json<Project[]>(await api.get(`/api/organizations/${organization.slug}/projects`));
  const project = projects.find((candidate) => candidate.slug === projectSlug);
  expect(project).toBeTruthy();
  const keys = await json<ProjectKey[]>(
    await api.get(`/api/organizations/${organization.slug}/projects/${projectSlug}/keys`),
  );
  expect(keys).toHaveLength(1);

  const allowAllPreflight = await api.fetch(`/api/${project!.publicId}/envelope/`, {
    method: "OPTIONS",
    headers: {
      origin: "https://unconfigured.example.com",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-sentry-auth",
    },
  });
  expect(allowAllPreflight.status()).toBe(204);
  expect(allowAllPreflight.headers()["access-control-allow-origin"]).toBe(
    "https://unconfigured.example.com",
  );
  expect(allowAllPreflight.headers()["access-control-allow-credentials"]).toBeUndefined();

  await page.goto(`/orgs/${organization.slug}/projects/${projectSlug}`);
  await page.getByRole("button", { name: "Settings" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Project settings" });
  await settingsDialog
    .locator('textarea[name="browserAllowedOrigins"]')
    .fill("http://127.0.0.1:55880");
  await settingsDialog.getByRole("button", { name: "Save project" }).click();
  await expect(settingsDialog).toBeHidden();

  const configuredProject = await json<Project>(
    await api.get(`/api/organizations/${organization.slug}/projects/${projectSlug}`),
  );
  expect(configuredProject.browserAllowedOrigins).toEqual(["http://127.0.0.1:55880"]);

  const allowedPreflight = await api.fetch(`/api/${project!.publicId}/envelope/`, {
    method: "OPTIONS",
    headers: {
      origin: "http://127.0.0.1:55880",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-sentry-auth",
    },
  });
  expect(allowedPreflight.status()).toBe(204);
  expect(allowedPreflight.headers()["access-control-allow-origin"]).toBe("http://127.0.0.1:55880");

  const rejectedPreflight = await api.fetch(`/api/${project!.publicId}/envelope/`, {
    method: "OPTIONS",
    headers: {
      origin: "https://blocked.example.com",
      "access-control-request-method": "POST",
    },
  });
  expect(rejectedPreflight.headers()["access-control-allow-origin"]).toBeUndefined();

  await sendError(api, project!, keys[0], "11111111111111111111111111111111", "1.0.0");

  let issue: Issue | undefined;
  await expect
    .poll(async () => {
      const result = await json<{ items: Issue[] }>(
        await api.get(`/api/organizations/${organization.slug}/projects/${projectSlug}/issues`),
      );
      issue = result.items[0];
      return issue?.timesSeen ?? 0;
    })
    .toBe(1);

  await page.goto(`/orgs/${organization.slug}/projects/${projectSlug}`);
  const issueTableTitle = page.getByRole("table").getByText(issue!.title, { exact: true });
  await expect(issueTableTitle).toBeVisible();
  await issueTableTitle.click();
  await expect(page.getByRole("heading", { name: issue!.title })).toBeVisible();

  await page.getByPlaceholder("Add a comment...").fill("Investigated by the E2E suite");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Investigated by the E2E suite").first()).toBeVisible();

  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect
    .poll(async () => {
      const detail = await json<{ issue: Issue }>(
        await api.get(`/api/organizations/${organization.slug}/projects/${projectSlug}/issues/${issue!.id}`),
      );
      return detail.issue.status;
    })
    .toBe("resolved");

  await sendError(api, project!, keys[0], "22222222222222222222222222222222", "1.1.0");
  await expect
    .poll(async () => {
      const detail = await json<{ issue: Issue }>(
        await api.get(`/api/organizations/${organization.slug}/projects/${projectSlug}/issues/${issue!.id}`),
      );
      return {
        status: detail.issue.status,
        isRegressed: detail.issue.isRegressed,
        timesSeen: detail.issue.timesSeen,
      };
    })
    .toEqual({ status: "open", isRegressed: true, timesSeen: 2 });

  await page.goto(`/orgs/${organization.slug}/projects/${projectSlug}?tab=keys`);
  await expect(page.getByText("Keys / DSN", { exact: true })).toBeVisible();
  await page.goto(`/orgs/${organization.slug}/projects/${projectSlug}?tab=inventory`);
  await expect(page.getByText("1.1.0", { exact: true }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Environments", exact: true }).click();
  await expect(page.getByText("production", { exact: true }).first()).toBeVisible();

  const longReleaseVersion = "5c7f2ccb6656cdc6f47863a3c91c2e5343f5d239";
  const longRelease = await api.put(
    `/api/organizations/${organization.slug}/projects/${projectSlug}/releases/${longReleaseVersion}`,
  );
  expect(longRelease.ok(), await longRelease.text()).toBe(true);
  await page.goto(`/orgs/${organization.slug}/projects/${projectSlug}?tab=inventory`);
  await page.getByRole("button", { name: new RegExp(longReleaseVersion) }).click();
  await expect(
    page.getByTestId("release-detail-card").getByRole("heading", { name: longReleaseVersion }),
  ).toBeVisible();
  for (const testId of ["release-list-card", "release-detail-card"]) {
    await expect
      .poll(() =>
        page.getByTestId(testId).evaluate((element) => element.scrollWidth <= element.clientWidth),
      )
      .toBe(true);
  }

  await page.goto(`/orgs/${organization.slug}/projects/${projectSlug}?tab=alerting`);
  await page.getByRole("button", { name: "New rule" }).click();
  const alertDialog = page.getByRole("dialog", { name: "New alert rule" });
  await alertDialog.locator('input[name="name"]').fill("E2E multi-trigger alert");
  await alertDialog.getByLabel("Regression").check();
  await alertDialog.getByLabel("Event threshold").check();
  await alertDialog.locator('input[name="threshold"]').fill("2");
  await alertDialog.locator('select[name="destinationType"]').selectOption("email");
  await alertDialog.locator('input[name="destinationTarget"]').fill("alerts@example.test");
  await alertDialog.getByRole("button", { name: "Create rule" }).click();
  const alertRuleForm = page.locator("form").filter({ hasText: "E2E multi-trigger alert" });
  await expect(alertRuleForm.getByText("E2E multi-trigger alert", { exact: true })).toBeVisible();
  await expect(
    alertRuleForm.locator("div.rounded-full").getByText("New issue", { exact: true }),
  ).toBeVisible();
  await expect(
    alertRuleForm.locator("div.rounded-full").getByText("Regression", { exact: true }),
  ).toBeVisible();
  await expect(alertRuleForm.getByText("Threshold 2", { exact: true })).toBeVisible();
  await alertRuleForm.getByRole("button", { name: "Test", exact: true }).click();
  await expect(
    page.getByText("Test alert: E2E multi-trigger alert", { exact: true }),
  ).toBeVisible();

  const limitedKey = await api.patch(
    `/api/organizations/${organization.slug}/projects/${projectSlug}/keys/${keys[0].id}`,
    { data: { rateLimitPerMinute: 1 } },
  );
  expect(limitedKey.ok(), await limitedKey.text()).toBe(true);
  await sendError(api, project!, keys[0], "33333333333333333333333333333333", "1.1.0");
  const rejected = await api.post(
    `/api/${project!.publicId}/store/?sentry_key=${encodeURIComponent(keys[0].publicKey)}`,
    {
      data: {
        event_id: "44444444444444444444444444444444",
        timestamp: new Date().toISOString(),
        platform: "javascript",
        level: "error",
        message: "Quota probe",
      },
    },
  );
  expect(rejected.status()).toBe(429);
  const metrics = await api.get("http://127.0.0.1:53001/api/metrics");
  expect(await metrics.text()).toContain(
    'spicytrack_ingest_events_total{outcome="rejected",reason="quota_exceeded"}',
  );
  const unlimitedKey = await api.patch(
    `/api/organizations/${organization.slug}/projects/${projectSlug}/keys/${keys[0].id}`,
    { data: { rateLimitPerMinute: null } },
  );
  expect(unlimitedKey.ok(), await unlimitedKey.text()).toBe(true);

  const oversized = await api.post(
    `/api/${project!.publicId}/store/?sentry_key=${encodeURIComponent(keys[0].publicKey)}`,
    { data: { message: "x".repeat(1_000_010) } },
  );
  expect(oversized.status()).toBe(413);
  const updatedMetrics = await api.get("http://127.0.0.1:53001/api/metrics");
  expect(await updatedMetrics.text()).toContain(
    'spicytrack_ingest_events_total{outcome="rejected",reason="payload_too_large"}',
  );

  const sdkDsn = `http://${keys[0].publicKey}@127.0.0.1:55174/${project!.publicId}`;
  for (const releaseVersion of ["sdk-browser@10.69.0", "sdk-react@10.69.0"]) {
    const release = await api.put(
      `/api/organizations/${organization.slug}/projects/${projectSlug}/releases/${encodeURIComponent(releaseVersion)}`,
    );
    expect(release.ok(), await release.text()).toBe(true);
    await uploadArtifact(api, releaseVersion, "~/app.js", "http://127.0.0.1:55880/app.js");
    await uploadArtifact(api, releaseVersion, "~/app.js.map", "http://127.0.0.1:55880/app.js.map");
  }

  for (const sdk of ["browser", "react"]) {
    const fixture = await page.context().newPage();
    await fixture.goto(`http://127.0.0.1:55880/?sdk=${sdk}&dsn=${encodeURIComponent(sdkDsn)}`);
    await expect(fixture.getByText("sent", { exact: true })).toBeVisible();
    await fixture.close();
  }

  for (const sdk of ["browser", "react"]) {
    let issue: Issue | undefined;
    await expect
      .poll(async () => {
        const result = await json<{ items: Issue[] }>(
          await api.get(
            `/api/organizations/${organization.slug}/projects/${projectSlug}/issues?q=${encodeURIComponent(`Real ${sdk} SDK compatibility probe`)}`,
          ),
        );
        issue = result.items[0];
        return issue?.id ?? null;
      })
      .not.toBeNull();
    const issueDetail = await json<IssueDetail>(
      await api.get(`/api/organizations/${organization.slug}/projects/${projectSlug}/issues/${issue!.id}`),
    );
    const event = await json<EventDetail>(
      await api.get(
        `/api/organizations/${organization.slug}/projects/${projectSlug}/events/${issueDetail.events.items[0].id}`,
      ),
    );
    expect(
      event.resolvedFrames?.some((frame) => frame.resolved && frame.resolution === "sourcemap"),
    ).toBe(true);
  }
});

test("keeps every primary authenticated screen accessible and responsive", async ({ page }) => {
  await signIn(page);
  await refreshOrganizationFromServer(page);

  const api = page.context().request;
  const issues = await json<{ items: Issue[] }>(
    await api.get(`/api/organizations/${organization.slug}/projects/${projectSlug}/issues`),
  );
  expect(issues.items[0]).toBeTruthy();

  const screens = primaryScreens(issues.items[0]);
  await page.goto("/app");
  const hasInstanceAdministrationAccess = (await page.getByRole("link", { name: "Instance administration" }).count()) > 0;
  const filteredScreens = hasInstanceAdministrationAccess
    ? screens
    : screens.filter((screen) => screen.name !== "instance administration");

  for (const screen of filteredScreens) {
    await test.step(screen.name, async () => {
      await page.goto(screen.url);
      await expect(page.getByRole("heading", { name: screen.heading }).first()).toBeVisible();
      await expectPageQuality(page, screen.name);
    });
  }
});

test("provides a usable mobile navigation without viewport overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await refreshOrganizationFromServer(page);

  const issues = await json<{ items: Issue[] }>(
    await page
      .context()
      .request.get(`/api/organizations/${organization.slug}/projects/${projectSlug}/issues`),
  );
  expect(issues.items[0]).toBeTruthy();

  await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const navigationDialog = page.getByRole("dialog", { name: "Navigation" });
  await expect(navigationDialog).toBeVisible();
  await navigationDialog.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(navigationDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: /Projects|E2E Company/ }).first()).toBeVisible();
  await expectPageQuality(page, "mobile navigation destination");

  const screens = primaryScreens(issues.items[0]);
  const hasInstanceAdministrationAccess = (await page.getByRole("link", { name: "Instance administration" }).count()) > 0;
  const filteredScreens = hasInstanceAdministrationAccess
    ? screens
    : screens.filter((screen) => screen.name !== "instance administration");

  for (const screen of filteredScreens) {
    await test.step(`mobile ${screen.name}`, async () => {
      await page.goto(screen.url);
      await expect(page.getByRole("heading", { name: screen.heading }).first()).toBeVisible();
      await expectPageQuality(page, `mobile ${screen.name}`);
    });
  }

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.keyboard.press("Escape");
  await expect(navigationDialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
});

test("authenticates through the real Keycloak OIDC authorization-code flow", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with Keycloak", exact: true }).click();

  await expect(page).toHaveURL(/keycloak\.test:58080\/realms\/spicytrack/);
  const authorizationUrl = new URL(page.url());
  expect(authorizationUrl.searchParams.get("client_id")).toBe("spicytrack-e2e");
  expect(authorizationUrl.searchParams.get("response_type")).toBe("code");
  expect(authorizationUrl.searchParams.get("code_challenge")).toBeTruthy();
  expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
  expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
    "http://127.0.0.1:55174/api/better-auth/oauth2/callback/keycloak",
  );
  await page.locator('input[name="username"]').fill("sso-user");
  await page.locator('input[name="password"]').fill("Sup3rSso!42");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await expect(page).toHaveURL(/127\.0\.0\.1:55174/);
  await expect(page.getByRole("heading", { name: "Organizations" })).toBeVisible();
  await refreshOrganizationFromServer(page);
  await expect(page.getByRole("link", { name: organization.name })).toBeVisible();

  const profile = await json<Me>(await page.context().request.get("/api/auth/me"));
  expect(profile.user.email).toBe(ssoEmail);
  expect(profile.user.emailVerifiedAt).not.toBeNull();
  expect(profile.memberships.length).toBeGreaterThan(0);
});

test("rejects a valid Keycloak account without a SpicyTrack invitation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Continue with Keycloak", exact: true }).click();

  await expect(page).toHaveURL(/keycloak\.test:58080\/realms\/spicytrack/);
  await page.locator('input[name="username"]').fill("blocked-user");
  await page.locator('input[name="password"]').fill("Sup3rBlocked!42");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();

  await expect(page).toHaveURL(/127\.0\.0\.1:55174/);
  await expect(
    page.getByText("SSO authentication failed. Please try again or contact your administrator."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Keycloak" })).toBeVisible();

  const profile = await page.context().request.get("/api/auth/me");
  expect(profile.status()).toBe(401);
  expect(await profile.text()).not.toContain(blockedSsoEmail);
});

test("serves MCP through the deployed HTTP stack with a real scoped credential", async ({
  page,
}) => {
  await signIn(page);
  await refreshOrganizationFromServer(page);

  const api = page.context().request;
  const projects = await json<Project[]>(await api.get(`/api/organizations/${organization.slug}/projects`));
  const project = projects.find((candidate) => candidate.slug === projectSlug);
  expect(project).toBeTruthy();

  const enable = await api.patch(`/api/organizations/${organization.slug}/mcp/settings`, {
    data: { enabled: true },
  });
  expect(enable.ok(), await enable.text()).toBe(true);
  const credentialResponse = await api.post(`/api/organizations/${organization.slug}/mcp/credentials`, {
    data: {
      name: "Deployed HTTP E2E",
      scopes: ["projects:read", "issues:read", "issues:write"],
      allProjects: true,
      projectIds: [],
    },
  });
  expect(credentialResponse.ok(), await credentialResponse.text()).toBe(true);
  const credential = (await credentialResponse.json()) as {
    credential: { id: string };
    secret: string;
  };

  const initialize = await mcpRpc(api, credential.secret, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "spicytrack-deployed-e2e", version: "1.0.0" },
    },
  });
  expect(initialize.response.ok(), await initialize.response.text()).toBe(true);
  expect(initialize.payload.result?.serverInfo?.name).toBe("spicytrack");

  const tools = await mcpRpc(api, credential.secret, {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });
  expect(tools.payload.result?.tools?.map(({ name }) => name)).toEqual(
    expect.arrayContaining(["list_projects", "list_issues", "get_issue", "update_issue"]),
  );
  expect(tools.payload.result?.tools?.map(({ name }) => name)).not.toContain("run_autofix");

  const listProjects = await mcpRpc(api, credential.secret, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "list_projects", arguments: {} },
  });
  const visibleProjects = JSON.parse(
    listProjects.payload.result?.content?.[0]?.text ?? "[]",
  ) as Project[];
  expect(visibleProjects).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: project!.id, slug: projectSlug })]),
  );

  const revoke = await api.delete(
    `/api/organizations/${organization.slug}/mcp/credentials/${credential.credential.id}`,
  );
  expect(revoke.ok(), await revoke.text()).toBe(true);
  const revoked = await mcpRpc(api, credential.secret, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/list",
    params: {},
  });
  expect(revoked.response.status()).toBe(401);
});
