import { BadRequestException } from "@nestjs/common";

import {
  ORGANIZATION_NAME_MAX_LENGTH,
  parseUpdateOrganizationBody,
} from "./organizations-controller.utils";

describe("parseUpdateOrganizationBody", () => {
  it("trims the new name", () => {
    expect(parseUpdateOrganizationBody({ name: "  Acme Inc.  " })).toEqual({ name: "Acme Inc." });
  });

  it("ignores the slug", () => {
    expect(parseUpdateOrganizationBody({ name: "Acme", slug: "other" })).toEqual({ name: "Acme" });
  });

  it("accepts a name at the maximum length", () => {
    const name = "a".repeat(ORGANIZATION_NAME_MAX_LENGTH);
    expect(parseUpdateOrganizationBody({ name })).toEqual({ name });
  });

  it("rejects missing, blank, non-string and too long names", () => {
    for (const name of [undefined, "", "   ", 42, "a".repeat(ORGANIZATION_NAME_MAX_LENGTH + 1)]) {
      expect(() => parseUpdateOrganizationBody({ name })).toThrow(BadRequestException);
    }
  });
});
