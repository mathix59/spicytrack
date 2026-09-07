import { expect, test, type Page } from "@playwright/test";

const profile = {
  user: {
    id: "owner",
    email: "owner@example.test",
    name: "Owner",
    emailVerifiedAt: "2026-01-01",
    twoFactorEnabled: false,
    isSuperAdmin: true,
  },
  memberships: [],
};
const settings = {
  registrationsEnabled: false,
  smtpHost: null,
  smtpPort: null,
  smtpSecure: null,
  smtpUser: null,
  smtpFrom: null,
  smtpPasswordConfigured: false,
};
async function mockApi(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === "/api/auth/me"
        ? profile
        : path === "/api/auth/registration-status"
          ? { registrationsEnabled: false, passwordEnabled: true, sso: null }
          : path === "/api/instance-admin/users"
            ? { items: [], total: 0, page: 1, pageSize: 20 }
            : [];
    await route.fulfill({ json });
  });
}

test("SMTP settings survive refresh and preserve the stored password", async ({ page }) => {
  await mockApi(page);
  let saved: Record<string, unknown> = { ...settings };
  await page.route("**/api/instance-admin/settings", async (route) => {
    if (route.request().method() === "PATCH") {
      expect(route.request().headers()["content-type"]).toContain("application/json");
      const { smtpPass, ...body } = route.request().postDataJSON();
      saved = {
        ...saved,
        ...body,
        smtpPasswordConfigured: Boolean(smtpPass) || saved.smtpPasswordConfigured,
      };
    }
    await route.fulfill({ json: saved });
  });
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Email delivery" }).click();
  await page.getByLabel("Host", { exact: true }).fill("smtp.example.test");
  await page.getByLabel("Port", { exact: true }).fill("465");
  await page.getByLabel("Connection security").selectOption("true");
  await page.getByLabel("Password", { exact: true }).fill("smtp-secret");
  await page.getByRole("button", { name: "Save SMTP settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Email delivery" }).click();
  await expect(page.getByLabel("Host", { exact: true })).toHaveValue("smtp.example.test");
  await expect(page.getByLabel("Connection security")).toHaveValue("true");
  await expect(page.getByLabel("Password (leave blank to keep)")).toHaveValue("");
  await page.getByRole("button", { name: "Save SMTP settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  expect(saved.smtpPasswordConfigured).toBe(true);
});

test("PAT creation displays its secret and resets the form without an error", async ({ page }) => {
  await mockApi(page);
  const tokens: unknown[] = [];
  await page.route("**/api/auth/tokens", async (route) => {
    if (route.request().method() === "POST") {
      const token = {
        id: "pat-id",
        name: "CI test",
        tokenPreview: "pat_test",
        createdAt: new Date().toISOString(),
      };
      tokens.push(token);
      await route.fulfill({ json: { token, secret: "pat_regression_secret" } });
    } else await route.fulfill({ json: tokens });
  });
  await page.goto("/account");
  await page.getByRole("tab", { name: "API", exact: true }).click();
  await page.getByPlaceholder("CI pipeline").fill("CI test");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("pat_regression_secret", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("CI pipeline")).toHaveValue("");
  await expect(page.getByText(/Cannot read|reset.*null|reset.*undefined/)).toHaveCount(0);
});

test("invitation opens signup with password when public registration is closed", async ({
  page,
}) => {
  await mockApi(page);
  let authenticated = false;
  let accepted = false;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: authenticated ? 200 : 401,
      json: authenticated ? profile : { message: "Missing credentials" },
    }),
  );
  await page.route("**/api/better-auth/sign-up/email", async (route) => {
    expect(route.request().headers()["x-invitation-token"]).toBe("invite-token");
    expect(route.request().postDataJSON().password).toBe("InvitePassword42!");
    authenticated = true;
    await route.fulfill({ json: { user: profile.user, token: "session" } });
  });
  await page.route("**/api/organizations/invitations/accept", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ token: "invite-token" });
    accepted = true;
    await route.fulfill({ json: { success: true } });
  });
  await page.goto("/invitations/accept?token=invite-token");
  await expect(page.getByText("Create your account", { exact: true })).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Invitee");
  await page.getByLabel("Email", { exact: true }).fill("invitee@example.test");
  await page.getByLabel("Password", { exact: true }).fill("InvitePassword42!");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  expect(accepted).toBe(true);
});

test("owner can delete an organization only after confirming its slug", async ({ page }) => {
  await mockApi(page);
  let deleted = false;
  const organization = {
    id: "org-id",
    slug: "acme",
    name: "Acme",
    status: "active",
    role: "owner",
    permissions: ["org.settings.manage"],
  };
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { ...profile, memberships: deleted ? [] : [organization] } }),
  );
  await page.route("**/api/organizations/acme", async (route) => {
    if (route.request().method() === "DELETE") deleted = true;
    await route.fulfill({ json: deleted ? { success: true } : organization });
  });
  await page.route("**/api/organizations/acme/settings/ai/usage", (route) =>
    route.fulfill({
      json: {
        days: 30,
        totals: {
          runs: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          estimatedCostMicros: 0,
        },
      },
    }),
  );
  await page.goto("/orgs/acme?tab=settings");
  await page.getByRole("tab", { name: "Delete organization" }).click();
  const button = page.getByRole("button", { name: "Delete organization permanently" });
  await expect(button).toBeDisabled();
  await page.getByLabel("Type acme to confirm").fill("acme");
  await button.click();
  await expect(page).toHaveURL(/\/app$/);
  expect(deleted).toBe(true);
});
