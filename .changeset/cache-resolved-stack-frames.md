---
"api": patch
---

Open events with source-mapped stack traces much faster: resolved frames are cached per release, and source maps are no longer downloaded and parsed again on every view. Uploading or deleting a release artifact refreshes the cache.
