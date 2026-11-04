import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it("keeps lowercase letters and digits joined by single dashes", () => {
    expect(slugify("  My API Project 2!  ")).toBe("my-api-project-2");
    expect(slugify("--Café / Backend--")).toBe("caf-backend");
    expect(slugify("???")).toBe("");
  });
});
