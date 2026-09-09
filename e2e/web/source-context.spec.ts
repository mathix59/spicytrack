import { expect, test } from "@playwright/test";

for (const wrappedBreadcrumbs of [false, true]) {
  test(`source maps and request clues show original context (wrapped breadcrumbs: ${wrappedBreadcrumbs})`, async ({
    page,
  }) => {
    const issue = {
      id: "issue",
      title: "Failed to fetch",
      status: "open",
      priority: "none",
      level: "error",
      firstSeenAt: "2026-09-09T12:00:00Z",
      lastSeenAt: "2026-09-09T12:00:00Z",
    };
    let onlySuccessfulRequests = false;
    const breadcrumbs = [
      null,
      {
        category: "xhr",
        type: "http",
        timestamp: 1788781908.007,
        data: { method: "PATCH", url: "https://api.example.test/reports/123", status_code: 422 },
      },
    ];
    breadcrumbs.push(
      {
        category: "xhr",
        type: "http",
        timestamp: 1788781909.086,
        data: { method: "PATCH", url: "https://api.example.test/reports/123", status_code: 422 },
      },
      {
        category: "xhr",
        type: "http",
        timestamp: 1788781909.086,
        data: { method: "GET", url: "https://api.example.test/success", status_code: 200 },
      },
      {
        category: "xhr",
        type: "http",
        timestamp: 1788781910,
        data: { method: "GET", url: "https://api.example.test/future", status_code: 500 },
      },
    );
    const frames = [
      {
        filename: "app.js",
        function: "a",
        lineno: 1,
        colno: 999,
        in_app: true,
        context_line: "minified context must not be shown",
      },
      {
        filename: "app:///frame_ant/frame_ant.js",
        function: "window.fetch",
        lineno: 2,
        colno: 14450,
      },
      { filename: "vendor.js", function: "b", lineno: 1, colno: 888, in_app: true },
    ];
    const mapped = [
      {
        filename: "src/load.ts",
        function: "load",
        lineno: 3,
        colno: 0,
        resolved: true,
        resolution: "sourcemap",
        diagnostic: "resolved",
        preContext: ["export async function load() {", "  const url = '/api/data';"],
        contextLine: "  return fetch(url);",
        postContext: ["}"],
      },
      {
        filename: frames[1].filename,
        function: "window.fetch",
        lineno: 2,
        colno: 14450,
        resolved: false,
        resolution: "sourcemap",
        diagnostic: "artifact_not_found",
      },
      {
        filename: "node_modules/@sentry/core/fetch.js",
        function: "instrumentFetch",
        lineno: 4,
        colno: 8,
        resolved: true,
        resolution: "sourcemap",
        diagnostic: "resolved",
        contextLine: "library wrapper",
      },
    ];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
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
      if (path === "/api/organizations/acme/projects/front")
        json = { id: "project", name: "Frontend" };
      if (path === "/api/organizations/acme/projects/front/issues")
        json = { items: [issue], total: 1 };
      if (path === "/api/organizations/acme/projects/front/issues/issue")
        json = { issue, events: { items: [{ id: "event" }], total: 1 } };
      if (path === "/api/organizations/acme/projects/front/events/event")
        json = {
          id: "event",
          eventId: "event123",
          timestamp: "2026-09-09T12:00:00Z",
          level: "error",
          rawPayload: {
            timestamp: 1788781909.087,
            breadcrumbs: onlySuccessfulRequests
              ? [breadcrumbs[3]]
              : wrappedBreadcrumbs
                ? { values: breadcrumbs }
                : breadcrumbs,
            request: { url: "https://example.test/reports/123/edit" },
            extra: { validation: "Report name is required" },
            exception: {
              values: [{ type: "TypeError", value: "Failed to fetch", stacktrace: { frames } }],
            },
          },
          resolvedFrames: mapped,
        };
      await route.fulfill({ json });
    });
    await page.goto("/orgs/acme/projects/front/issues/issue");
    const failures = page.getByRole("region", { name: "Failed outgoing requests" });
    await expect(failures).toBeVisible();
    await expect(failures.getByRole("listitem")).toHaveCount(1);
    await expect(failures).toContainText("HTTP 422");
    await expect(failures).toContainText("PATCH");
    await expect(failures).toContainText("2 failures");
    await expect(failures).toContainText("Last failure 1 ms before this event");
    await expect(failures).toContainText("https://api.example.test/reports/123");
    await expect(failures).not.toContainText("/edit");
    await expect(failures).not.toContainText("/success");
    await expect(failures).not.toContainText("/future");
    const requestContext = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "HTTP Request", exact: true }) });
    await expect(
      requestContext.getByText("https://example.test/reports/123/edit", { exact: true }),
    ).toBeVisible();
    const activity = page.getByRole("heading", { name: "Breadcrumbs", exact: true }).locator("..");
    await expect(activity.getByRole("listitem")).toHaveCount(4);
    await expect(
      activity.getByText("https://api.example.test/reports/123", { exact: true }).first(),
    ).toBeVisible();
    await expect(activity.getByText("422", { exact: true }).first()).toBeVisible();
    await expect(activity.getByText("PATCH", { exact: true }).first()).toBeVisible();
    await expect(
      page.locator("dd").getByText("Report name is required", { exact: true }),
    ).toBeVisible();
    const application = page.getByRole("button", { name: /src\/load.ts/ });
    await expect(application).toHaveAttribute("aria-expanded", "true");
    await expect(application).toContainText("3:0");
    await expect(application).not.toContainText("999");
    await expect(
      page.locator("span.whitespace-pre").filter({ hasText: "minified context must not be shown" }),
    ).toHaveCount(0);
    await expect(page.getByText("library wrapper")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /node_modules\/@sentry/ })).toContainText(
      "library",
    );
    await expect(
      page.locator("span.whitespace-pre").filter({ hasText: "return fetch(url);" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /frame_ant/ }).click();
    await expect(page.getByText(/No uploaded artifact matches this script/)).toBeVisible();
    onlySuccessfulRequests = true;
    await page.reload();
    await expect(page.getByRole("button", { name: /src\/load.ts/ })).toBeVisible();
    await expect(failures).toHaveCount(0);
  });
}
