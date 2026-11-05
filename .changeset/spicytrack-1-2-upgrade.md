---
"api": minor
"web": minor
---

Upgrade notes:

- Back up the database first. The migrations attach the events table to a weekly partitioned table in one transaction (about 8 seconds per million events, measured locally), and ingestion waits during that time; plan a maintenance window on large instances. With Helm, the migration hook timeout must cover it (see the chart README).
- In production, every service now refuses to start without a valid configuration: `SECRETS_ENCRYPTION_KEY` (32 bytes) and `BETTER_AUTH_SECRET` are required, and invalid URLs, numbers or `AI_PRICING_JSON` are reported at startup.
- Behind Coolify or Dokploy, the PaaS compose file trusts two proxy hops (`TRUST_PROXY=2`) so audit logs record the client address; the Helm chart sets it from the ingress setting.
- Existing personal access tokens keep their full access; new tokens choose a scope and expire after 90 days by default.
- Hourly ingestion quotas are approximate when several ingest replicas run: a window can overshoot by about one second of traffic per replica. Per-key limits stay exact.
