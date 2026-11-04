import { expect, type Page, test } from "@playwright/test";

const total = 45;
const pageSize = 20;

/** Mocks an issue with `total` events served in pages of `pageSize`; returns requested pages. */
async function mockPagedIssue(page: Page) {
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
  return eventPages;
}

test("stepping to older events crosses into the next event page and stays there", async ({
  page,
}) => {
  const eventPages = await mockPagedIssue(page);

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

test("jumping to the oldest and newest events loads their pages and keeps the selection", async ({
  page,
}) => {
  const eventPages = await mockPagedIssue(page);
  const lastPage = Math.ceil(total / pageSize);
  const eventLabel = (number: number) => page.getByText(`Event ${number} of ${total}`, { exact: true });
  const newest = page.getByRole("button", { name: "Newest event" });
  const oldest = page.getByRole("button", { name: "Oldest event" });

  await page.goto("/orgs/acme/projects/front/issues/issue");
  await expect(eventLabel(1)).toBeVisible();
  await expect(newest).toBeDisabled();

  await oldest.click();
  await expect(eventLabel(total)).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(eventLabel(total)).toBeVisible();
  await expect(oldest).toBeDisabled();
  await expect(page.getByRole("button", { name: /Older/ })).toBeDisabled();
  expect(eventPages.at(-1)).toBe(lastPage);

  // Stepping newer from the first event of a page lands on the last event of the page before.
  const newer = page.getByRole("button", { name: /Newer/ });
  const firstOfLastPage = (lastPage - 1) * pageSize + 1;
  for (let number = total - 1; number >= firstOfLastPage - 1; number -= 1) {
    await newer.click();
    await expect(eventLabel(number)).toBeVisible();
  }
  await page.waitForTimeout(1_000);
  await expect(eventLabel(firstOfLastPage - 1)).toBeVisible();

  await newest.click();
  await expect(eventLabel(1)).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(eventLabel(1)).toBeVisible();
  await expect(newest).toBeDisabled();
  expect(eventPages.at(-1)).toBe(1);
});
