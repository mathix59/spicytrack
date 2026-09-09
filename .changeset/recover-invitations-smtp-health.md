---
"api": patch
"web": patch
---

Recover interrupted invitation signup by authenticating existing accounts before accepting the pending invitation. Preserve registration mode when returning from older invitation login redirects and allow retrying acceptance.

Keep SMTP verification off the API readiness path, cache bounded background probes, and use successful delivery as health evidence. SMTP diagnostic failures no longer make the API unavailable; TLS verification remains enabled.
