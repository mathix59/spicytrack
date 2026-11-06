---
"api": patch
---

Fix the release Compose file so the admin worker receives `BETTER_AUTH_SECRET`. Without it the worker restarted in a loop on installs made with `install.sh`, and background jobs (alerts, digests, retention, post-ingest processing) never ran. Pull the new `docker-compose.release.yml` before upgrading. The pre-production smoke test now checks metrics only when `SPICYTRACK_METRICS_URL` points at the API directly, since the public proxy hides `/api/metrics`.
