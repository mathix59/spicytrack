import { describe, expect, it } from "vitest";

import { isSmtpDraftDirty, pickSmtpFields } from "./use-smtp-form";

const saved = pickSmtpFields({
  registrationsEnabled: true,
  smtpHost: "smtp.example.test",
  smtpPort: 587,
  smtpSecure: null,
  smtpUser: null,
  smtpFrom: "SpicyTrack <alerts@example.test>",
  smtpPasswordConfigured: true,
});

describe("isSmtpDraftDirty", () => {
  it("is clean when the draft matches the saved settings", () => {
    expect(isSmtpDraftDirty(saved, { ...saved }, "")).toBe(false);
  });

  it("detects a changed field", () => {
    expect(isSmtpDraftDirty(saved, { ...saved, smtpPort: 465 }, "")).toBe(true);
    expect(isSmtpDraftDirty(saved, { ...saved, smtpSecure: true }, "")).toBe(true);
  });

  it("detects a newly typed password", () => {
    expect(isSmtpDraftDirty(saved, { ...saved }, "secret")).toBe(true);
  });
});
