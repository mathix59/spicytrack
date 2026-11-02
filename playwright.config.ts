import { defineConfig, devices } from "@playwright/test";

// E2E_BROWSERS (comma separated) restricts the browser projects; chromium always runs because
// the other projects depend on it.
const selectedBrowsers = (process.env.E2E_BROWSERS ?? "")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

export default defineConfig({
  testDir: "./e2e/web",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_WEB_URL ?? "http://127.0.0.1:55174",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--host-resolver-rules=MAP keycloak.test 127.0.0.1"],
        },
      },
    },
    {
      name: "firefox",
      dependencies: ["chromium"],
      grep: /public authentication|primary authenticated|mobile navigation/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      dependencies: ["chromium"],
      grep: /public authentication|primary authenticated|mobile navigation/,
      use: { ...devices["Desktop Safari"] },
    },
  ].filter(
    (project) =>
      selectedBrowsers.length === 0 || project.name === "chromium" || selectedBrowsers.includes(project.name),
  ),
});
