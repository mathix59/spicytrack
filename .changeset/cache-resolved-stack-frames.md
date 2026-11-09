---
"api": patch
---

Open events with source-mapped stack traces in milliseconds instead of seconds. The worker source-maps each new event's frames after ingest and stores them in PostgreSQL, so the first view, every API instance and restarts all reuse them instead of downloading and parsing the source maps again. Uploading, replacing or deleting a release artifact clears its stored frames, and the hourly retention job removes the frames of releases that received no event for 30 days. Run the database migration before starting the new API and worker.
