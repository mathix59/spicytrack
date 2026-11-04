import { parseCreateTokenBody } from "./personal-tokens.utils";
import { scopeForPermission, tokenAllows, tokenAllowsMethod, tokenLevel } from "./token-scopes";

describe("token scopes", () => {
  it("are cumulative", () => {
    expect(tokenLevel(["read", "admin"])).toBe("admin");
    expect(tokenAllows(["write"], "read")).toBe(true);
    expect(tokenAllows(["write"], "admin")).toBe(false);
    expect(tokenAllows([], "read")).toBe(false);
  });

  it("map permissions to the scope they need", () => {
    expect(scopeForPermission("project.issues.read")).toBe("read");
    expect(scopeForPermission("audit.read")).toBe("read");
    expect(scopeForPermission("project.issues.manage")).toBe("write");
    expect(scopeForPermission("project.autofix.run")).toBe("write");
    expect(scopeForPermission("org.members.invite")).toBe("admin");
    expect(scopeForPermission("org.settings.manage")).toBe("admin");
  });

  it("keep read-only tokens to safe methods", () => {
    expect(tokenAllowsMethod(["read"], "GET")).toBe(true);
    expect(tokenAllowsMethod(["read"], "PATCH")).toBe(false);
    expect(tokenAllowsMethod(["write"], "DELETE")).toBe(true);
  });
});

describe("parseCreateTokenBody", () => {
  it("defaults to a 90-day expiry", () => {
    expect(parseCreateTokenBody({ name: "CI", scopes: ["read", "read"] })).toEqual({
      name: "CI",
      scopes: ["read"],
      organizationId: null,
      expiresInDays: 90,
    });
  });

  it("rejects missing scopes, bad organizations and long expiries", () => {
    expect(() => parseCreateTokenBody({ name: "CI" })).toThrow("scopes must list");
    expect(() => parseCreateTokenBody({ name: "CI", scopes: ["root"] })).toThrow(
      "scopes must be one of",
    );
    expect(() =>
      parseCreateTokenBody({ name: "CI", scopes: ["read"], organizationId: "acme" }),
    ).toThrow("organizationId must be an organization ID");
    expect(() =>
      parseCreateTokenBody({ name: "CI", scopes: ["read"], expiresInDays: 400 }),
    ).toThrow("between 1 and 365");
  });
});
