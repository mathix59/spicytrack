---
"api": minor
"web": minor
---

Redesign the web app with light and dark themes, a command palette, a reworked issue inbox and issue detail (stack traces with original source context, library frames, an event pager), event trends and charts, project tabs, organization settings, and an SDK onboarding wizard that waits for the first event and can send test events.

Triage issues faster: structured issue search, tag breakdowns and affected users, resolve in the next release, a merge picker, keyboard navigation and bulk selection. Grouping v2 keeps issues stable across deploys and variable messages; existing issues are adopted on their next event.

Connect the tools around the errors: alerts delivered through retried jobs with rich Slack and Discord messages, PagerDuty and signed webhooks; an interactive Slack app to resolve, ignore and assign; GitHub, Linear and Jira tickets created from issues; release commits and suspect commits; sessions and release health; an MCP server; and Autofix, which runs a root-cause analysis and can open a CI-gated pull request within an AI budget.

Administer the instance safely: an organization audit log (and per-project and instance logs) with filters and export, scoped personal access tokens with an organization restriction and an expiry, organization renaming, a QR code in the two-factor setup, roles with descriptions and member counts, and an SMTP test email from the instance settings.

Scale ingestion on Postgres alone: events partitioned by week so retention drops whole weeks, batched issue counters, coalesced alert jobs, hourly quotas counted in memory, quota responses that tell SDKs when to retry, structured JSON logs, and worker health probes and metrics.
