import { expect, test, type Page } from "@playwright/test";

const me = {
  id: "owner",
  email: "owner@example.test",
  name: "Owner",
  emailVerifiedAt: "2026-01-01",
  twoFactorEnabled: false,
  isSuperAdmin: true,
};
const settings = {
  registrationsEnabled: true,
  smtpHost: "smtp.example.test",
  smtpPort: 587,
  smtpSecure: null,
  smtpUser: null,
  smtpFrom: "SpicyTrack <alerts@example.test>",
  smtpPasswordConfigured: false,
};
const users = [
  { id: "owner", name: "Owner", email: me.email, isSuperAdmin: true, createdAt: "2026-01-01" },
  {
    id: "member",
    name: "Member",
    email: "member@example.test",
    isSuperAdmin: false,
    createdAt: "2026-02-01",
  },
];

async function mockInstanceAdmin(page: Page, overrides: { superAdminCount?: number } = {}) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json =
      path === "/api/auth/me"
        ? { user: me, memberships: [] }
        : path === "/api/instance-admin/settings"
          ? settings
          : path === "/api/instance-admin/users"
            ? {
                items: users,
                total: users.length,
                superAdminCount: overrides.superAdminCount ?? 1,
                page: 1,
                pageSize: 20,
              }
            : [];
    await route.fulfill({ json });
  });
}

test("instance admins cannot delete or demote themselves", async ({ page }) => {
  await mockInstanceAdmin(page);
  await page.goto("/admin?tab=users");

  const own = page.getByRole("listitem").filter({ hasText: me.email });
  await expect(own.getByText("You", { exact: true })).toBeVisible();
  await expect(own.getByRole("button", { name: "Delete user" })).toHaveCount(0);
  const ownSwitch = own.getByRole("switch", { name: `Super-admin access for ${me.email}` });
  await expect(ownSwitch).toBeDisabled();
  await expect(ownSwitch).toHaveAccessibleDescription(/Ask another administrator/);

  const other = page.getByRole("listitem").filter({ hasText: "member@example.test" });
  await expect(other.getByText("You", { exact: true })).toHaveCount(0);
  await expect(other.getByRole("button", { name: "Delete user" })).toBeVisible();
  await expect(other.getByRole("switch")).toBeEnabled();
});

test("the delete-user dialog submits with Enter only once the email matches", async ({ page }) => {
  await mockInstanceAdmin(page);
  const deletes: unknown[] = [];
  await page.route("**/api/instance-admin/users/member", async (route) => {
    deletes.push(route.request().postDataJSON());
    await route.fulfill({ json: { success: true } });
  });
  await page.goto("/admin?tab=users");

  await page.getByRole("button", { name: "Delete user", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Delete user permanently" });
  const input = dialog.getByLabel("Type member@example.test to confirm");
  await input.fill("member@example");
  await input.press("Enter");
  await expect(dialog).toBeVisible();
  expect(deletes).toHaveLength(0);

  await input.fill("member@example.test");
  await input.press("Enter");
  await expect(dialog).toBeHidden();
  expect(deletes).toEqual([{ confirmationEmail: "member@example.test" }]);
});

test("admin tabs live in the URL and keep unsaved SMTP edits", async ({ page }) => {
  await mockInstanceAdmin(page);
  const testEmails: string[] = [];
  await page.route("**/api/instance-admin/smtp/test-email", async (route) => {
    testEmails.push(route.request().method());
    await route.fulfill({ json: { success: true, to: me.email } });
  });
  await page.goto("/admin?tab=email");
  await expect(page.getByRole("tab", { name: /Email delivery/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Connection security")).toContainText(
    "Automatic (implicit TLS on 465, STARTTLS otherwise)",
  );

  const host = page.getByLabel("Host", { exact: true });
  await host.fill("draft.example.test");
  const sendTestEmail = page.getByRole("button", { name: "Send test email" });
  await expect(sendTestEmail).toBeDisabled();
  await expect(page.getByRole("tab", { name: "Email delivery (unsaved changes)" })).toBeVisible();

  await page.getByRole("tab", { name: "Users", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\?tab=users$/);
  await page.getByRole("tab", { name: /Email delivery/ }).click();
  await expect(host).toHaveValue("draft.example.test");

  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(host).toHaveValue("smtp.example.test");
  await sendTestEmail.click();
  await expect(page.getByText(`Test email sent to ${me.email}.`, { exact: false })).toBeVisible();
  expect(testEmails).toEqual(["POST"]);

  await page.goBack();
  await expect(page.getByRole("tab", { name: "Users", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("closing public registration names the change and can be undone", async ({ page }) => {
  await mockInstanceAdmin(page);
  const writes: boolean[] = [];
  await page.route("**/api/instance-admin/settings", async (route) => {
    if (route.request().method() === "PATCH") {
      const { registrationsEnabled } = route.request().postDataJSON();
      writes.push(registrationsEnabled);
      settings.registrationsEnabled = registrationsEnabled;
    }
    await route.fulfill({ json: settings });
  });
  await page.goto("/admin");

  const toggle = page.getByRole("switch", { name: "Allow new registrations" });
  await toggle.click();
  await expect(page.getByText("Public registration closed", { exact: true })).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Public registration opened", { exact: true })).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(writes).toEqual([false, true]);
});
