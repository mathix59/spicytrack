import { describe, expect, it } from "vitest";

import { activeInboxPreset } from "./inbox-presets";

const base = {
  statusFilter: "open",
  assignedUserFilter: "all",
  regressedFilter: "all",
  issueSearch: "",
};

describe("activeInboxPreset", () => {
  it("matches each preset from the filters", () => {
    expect(activeInboxPreset(base)).toBe("incoming");
    expect(activeInboxPreset({ ...base, assignedUserFilter: "__unassigned__" })).toBe("unassigned");
    expect(activeInboxPreset({ ...base, regressedFilter: "true" })).toBe("regressed");
    expect(activeInboxPreset({ ...base, statusFilter: "resolved" })).toBe("resolved");
  });

  it("matches no preset for other filter combinations", () => {
    expect(activeInboxPreset({ ...base, statusFilter: "ignored" })).toBeNull();
    expect(activeInboxPreset({ ...base, issueSearch: "TypeError" })).toBeNull();
    expect(activeInboxPreset({ ...base, assignedUserFilter: "u1" })).toBeNull();
  });
});
