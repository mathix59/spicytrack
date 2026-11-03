import { BadRequestException } from "@nestjs/common";

import { optionalDescription } from "./validators";

describe("optionalDescription", () => {
  it("keeps the stored value when the field is omitted", () => {
    expect(optionalDescription(undefined)).toBeUndefined();
  });

  it("clears the value for null or blank text", () => {
    expect(optionalDescription(null)).toBeNull();
    expect(optionalDescription("   ")).toBeNull();
  });

  it("trims the text", () => {
    expect(optionalDescription("  Triage only  ")).toBe("Triage only");
  });

  it("rejects non-strings and text over the limit", () => {
    expect(() => optionalDescription(42)).toThrow(BadRequestException);
    expect(() => optionalDescription("x".repeat(281))).toThrow(BadRequestException);
    expect(optionalDescription("x".repeat(280))).toHaveLength(280);
  });
});
