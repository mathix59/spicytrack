import { expect, test, type Page } from "@playwright/test";

async function mockIssues(page: Page) {
  const requests: number[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let json: unknown = [];
    if (url.pathname === "/api/auth/me")
      json = {
        user: {
          id: "owner",
          email: "owner@example.test",
          name: "Owner",
          emailVerifiedAt: "2026-09-01",
        },
        memberships: [{ slug: "acme", name: "Acme", role: "owner", permissions: [] }],
      };
    if (url.pathname === "/api/organizations/acme/projects/backend")
      json = {
        id: "project",
        name: "Backend",
        slug: "backend",
        platform: "python",
        visibility: "private",
      };
    if (url.pathname === "/api/organizations/acme/projects/backend/issues") {
      const current = Number(url.searchParams.get("page") ?? 1);
      requests.push(current);
      // Simulate the gap between the query key changing and the new page arriving.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const total = url.searchParams.get("q") ? 1 : 60;
      const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
      const count = Math.max(0, Math.min(pageSize, total - (current - 1) * pageSize));
      json = {
        page: current,
        pageSize,
        total,
        items: Array.from({ length: count }, (_, i) => ({
          id: `issue-${(current - 1) * pageSize + i + 1}`,
          title: `Issue ${(current - 1) * pageSize + i + 1}`,
          level: "error",
          status: "open",
          timesSeen: 1,
          firstSeenAt: "2026-09-01T12:00:00Z",
          lastSeenAt: "2026-09-01T12:00:00Z",
        })),
      };
    }
    await route.fulfill({ json });
  });
  return requests;
}

test("issue pagination advances, goes back, and survives a refresh", async ({ page }) => {
  await mockIssues(page);
  await page.goto("/orgs/acme/projects/backend");
  await expect(
    page.getByText("60 issues matching filters · page 1 of 3", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByText("60 issues matching filters · page 2 of 3", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Issue 26", { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  await page.reload();
  await expect(page.getByText("Issue 26", { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Issue 51", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByText("Issue 26", { exact: true }).last()).toBeVisible();
  await page.getByRole("textbox", { name: "Search issues" }).fill("filtered");
  await expect(
    page.getByText("1 issues matching filters · page 1 of 1", { exact: true }),
  ).toBeVisible();
  await expect(page).not.toHaveURL(/page=2/);
});

test("an out-of-range issue page is corrected only after its response arrives", async ({
  page,
}) => {
  const requests = await mockIssues(page);
  await page.goto("/orgs/acme/projects/backend?page=8");
  await expect(
    page.getByText("60 issues matching filters · page 3 of 3", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Issue 51", { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL(/page=3/);
  expect(requests).toEqual([8, 3]);
});
