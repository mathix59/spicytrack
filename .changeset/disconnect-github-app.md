---
"api": patch
"web": patch
---

Disconnect GitHub from the organization settings. SpicyTrack forgets the GitHub App credentials, its installation and repositories, and the project repositories linked through the App; repositories connected with a personal token keep working. The action is recorded in the audit log, and the App itself stays on GitHub until you delete it there.
