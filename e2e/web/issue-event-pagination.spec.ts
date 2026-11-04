import { expect, test } from "@playwright/test";

test("stepping to older events crosses into the next event page and stays there", async ({
  page,
}) => {
  const total = 45;
  const pageSize = 20;
  const issue = {
    id: "issue",
    title: "TypeError: x is undefined",
    status: "open",
    priority: "none",
    level: "error",
    firstSeenAt: "2026-09-09T12:00:00Z",
    lastSeenAt: "2026-09-09T12:00:00Z",
  };
  const eventPages: number[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json: unknown = [];
    if (path === "/api/auth/me")
      json = {
        user: {
          id: "owner",
          email: "owner@example.test",
          name: "Owner",
          emailVerifiedAt: "2026-09-01",
        },
        memberships: [],
      };
    if (path === "/api/organizations/acme/projects/front") json = { id: "project", name: "Frontend" };
    if (path === "/api/organizations/acme/projects/front/issues/issue") {
      const eventPage = Number(url.searchParams.get("eventPage") ?? 1);
      eventPages.push(eventPage);
      // The gap between the page changing and its events arriving is what used to reset it.
      if (eventPage > 1) await new Promise((resolve) => setTimeout(resolve, 300));
      const first = (eventPage - 1) * pageSize + 1;
      const count = Math.max(0, Math.min(pageSize, total - first + 1));
      json = {
        issue,
        events: {
          items: Array.from({ length: count }, (_, index) => ({ id: `event-${first + index}` })),
          total,
        },
      };
    }
    const event = /^\/api\/organizations\/acme\/projects\/front\/events\/(event-\d+)$/.exec(path);
    if (event)
      json = {
        id: event[1],
        eventId: event[1],
        timestamp: "2026-09-09T12:00:00Z",
        level: "error",
        rawPayload: {},
      };
    await route.fulfill({ json });
  });

  await page.goto("/orgs/acme/projects/front/issues/issue");
  await expect(page.getByText(`Event 1 of ${total}`, { exact: true })).toBeVisible();
  const older = page.getByRole("button", { name: /Older/ });
  for (let step = 2; step <= pageSize + 1; step += 1) {
    await older.click();
    await expect(page.getByText(`Event ${step} of ${total}`, { exact: true })).toBeVisible();
  }

  // Still on the second page once its events have long arrived.
  await page.waitForTimeout(1_000);
  await expect(page.getByText(`Event ${pageSize + 1} of ${total}`, { exact: true })).toBeVisible();
  expect(eventPages).toContain(2);
  expect(eventPages.at(-1)).toBe(2);
});
