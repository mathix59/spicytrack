import { describe, expect, it } from "vitest";

import { inputsChanged } from "./utils";

describe("inputsChanged", () => {
  it("treats never-seen inputs as changed", () => {
    expect(inputsChanged(null, [])).toBe(true);
    expect(inputsChanged(null, [undefined])).toBe(true);
  });

  it("compares inputs by identity like effect dependencies", () => {
    const repo = { fullName: "acme/api" };
    expect(inputsChanged(["main", true, repo], ["main", true, repo])).toBe(false);
    expect(inputsChanged(["main", true, repo], ["main", true, { ...repo }])).toBe(true);
    expect(inputsChanged(["main", true], ["main", false])).toBe(true);
    expect(inputsChanged([Number.NaN], [Number.NaN])).toBe(false);
    expect(inputsChanged([undefined], [null])).toBe(true);
    expect(inputsChanged(["main"], ["main", true])).toBe(true);
  });
});
