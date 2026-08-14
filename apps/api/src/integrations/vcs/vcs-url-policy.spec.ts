import { assertAllowedVcsEndpoints, vcsEndpointsChanged } from "./vcs-url-policy";

describe("VCS URL policy", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("allows official cloud endpoints", () => {
    expect(() =>
      assertAllowedVcsEndpoints("github", {
        baseUrl: null,
        htmlUrl: "https://github.com",
        apiUrl: "https://api.github.com",
      }),
    ).not.toThrow();
    expect(() =>
      assertAllowedVcsEndpoints("gitlab", {
        baseUrl: "https://gitlab.com",
        htmlUrl: null,
        apiUrl: null,
      }),
    ).not.toThrow();
  });

  it("rejects custom, credentialed and insecure endpoints by default", () => {
    expect(() =>
      assertAllowedVcsEndpoints("gitlab", {
        baseUrl: "https://untrusted.example",
        htmlUrl: null,
        apiUrl: null,
      }),
    ).toThrow("not allowed");
    expect(() =>
      assertAllowedVcsEndpoints("gitlab", {
        baseUrl: "https://user:password@gitlab.com",
        htmlUrl: null,
        apiUrl: null,
      }),
    ).toThrow("must not contain credentials");
    expect(() =>
      assertAllowedVcsEndpoints("gitlab", {
        baseUrl: "http://gitlab.com",
        htmlUrl: null,
        apiUrl: null,
      }),
    ).toThrow("must use HTTPS");
  });

  it("allows an explicitly configured Enterprise host", () => {
    process.env.VCS_ALLOWED_HOSTS = "github.corp.example,gitlab.corp.example";
    expect(() =>
      assertAllowedVcsEndpoints("github", {
        baseUrl: null,
        htmlUrl: "https://github.corp.example",
        apiUrl: "https://github.corp.example/api/v3",
      }),
    ).not.toThrow();
  });

  it("detects endpoint changes before a stored token can be reused", () => {
    expect(
      vcsEndpointsChanged(
        "github",
        { baseUrl: null, htmlUrl: "https://github.com/", apiUrl: null },
        { baseUrl: null, htmlUrl: "https://github.com", apiUrl: null },
      ),
    ).toBe(false);
    expect(
      vcsEndpointsChanged(
        "github",
        { baseUrl: null, htmlUrl: "https://github.com", apiUrl: null },
        { baseUrl: null, htmlUrl: "https://github.corp.example", apiUrl: null },
      ),
    ).toBe(true);
  });
});
