import { GithubProvider } from "./github.provider";
import { GitlabProvider } from "./gitlab.provider";
import { VcsRequestError } from "./vcs-provider.interface";

describe("VCS providers", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.VCS_ALLOWED_HOSTS = "github.corp.example,gitlab.example.com";
    delete process.env.VCS_ALLOW_INSECURE_HTTP;
  });

  afterEach(() => {
    delete process.env.VCS_ALLOWED_HOSTS;
    delete process.env.VCS_ALLOW_INSECURE_HTTP;
  });

  const jsonResponse = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

  describe("GithubProvider", () => {
    const provider = new GithubProvider();

    it("validates against api.github.com by default", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ default_branch: "main", html_url: "https://github.com/o/r" }),
      );

      const info = await provider.validateConnection({
        baseUrl: null,
        repoIdentifier: "o/r",
        token: "tok",
      });

      expect(info.defaultBranch).toBe("main");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.github.com/repos/o/r");
      expect(init.headers.Authorization).toBe("Bearer tok");
      expect(init.redirect).toBe("error");
    });

    it("uses /api/v3 for GitHub Enterprise base URLs", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ default_branch: "dev", html_url: "x" }));

      await provider.validateConnection({
        baseUrl: "https://github.corp.example/",
        repoIdentifier: "o/r",
        token: "tok",
      });

      expect(fetchMock.mock.calls[0][0]).toBe("https://github.corp.example/api/v3/repos/o/r");
    });

    it("builds an authenticated clone URL", () => {
      expect(
        provider.getAuthenticatedCloneUrl({
          baseUrl: null,
          repoIdentifier: "o/r",
          token: "tok",
        }),
      ).toBe("https://x-access-token:tok@github.com/o/r.git");
    });

    it("throws VcsRequestError with the status on failure", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: "Bad credentials" }, 401));

      await expect(
        provider.validateConnection({
          baseUrl: null,
          repoIdentifier: "o/r",
          token: "bad",
        }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it("creates a pull request", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ html_url: "https://github.com/o/r/pull/1", number: 1 }),
      );

      const pr = await provider.createPullRequest(
        { baseUrl: null, repoIdentifier: "o/r", token: "tok" },
        { sourceBranch: "fix", targetBranch: "main", title: "t", body: "b" },
      );

      expect(pr.url).toBe("https://github.com/o/r/pull/1");
      expect(pr.id).toBe("1");
      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        title: "t",
        head: "fix",
        base: "main",
        body: "b",
      });
    });

    it("squash-merges a pull request", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ merged: true }));

      await provider.mergePullRequest({ baseUrl: null, repoIdentifier: "o/r", token: "tok" }, "12");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.github.com/repos/o/r/pulls/12/merge");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ merge_method: "squash" });
    });

    it("reports a merge refusal even when GitHub returns 200", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ merged: false, message: "checks pending" }));

      await expect(
        provider.mergePullRequest({ baseUrl: null, repoIdentifier: "o/r", token: "tok" }, "12"),
      ).rejects.toMatchObject({ status: 409, message: "checks pending" });
    });
    it("combines check runs and commit statuses", async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({
            check_runs: [
              { name: "test", status: "completed", conclusion: "success" },
              { name: "docs", status: "completed", conclusion: "skipped" },
              { name: "e2e", status: "in_progress", conclusion: null },
            ],
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ statuses: [{ context: "ci/legacy", state: "failure" }] }),
        );

      const checks = await provider.getCommitChecks(
        { baseUrl: null, repoIdentifier: "o/r", token: "tok" },
        "abc1234",
      );

      expect(checks).toEqual({
        state: "failure",
        total: 4,
        failed: ["ci/legacy"],
        pending: ["e2e"],
      });
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.github.com/repos/o/r/commits/abc1234/check-runs?per_page=100",
      );
    });

    it("rejects a malformed commit SHA before calling GitHub", async () => {
      await expect(
        provider.getCommitChecks({ baseUrl: null, repoIdentifier: "o/r", token: "tok" }, "../x"),
      ).rejects.toMatchObject({ status: 400 });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("GitlabProvider", () => {
    const provider = new GitlabProvider();

    it("encodes the project path and uses PRIVATE-TOKEN", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ default_branch: "main", web_url: "x" }));

      await provider.validateConnection({
        baseUrl: null,
        repoIdentifier: "group/sub/project",
        token: "glpat",
      });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://gitlab.com/api/v4/projects/group%2Fsub%2Fproject");
      expect(init.headers["PRIVATE-TOKEN"]).toBe("glpat");
      expect(init.redirect).toBe("error");
    });

    it("supports self-hosted base URLs", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ default_branch: "main", web_url: "x" }));

      await provider.validateConnection({
        baseUrl: "https://gitlab.example.com",
        repoIdentifier: "g/p",
        token: "glpat",
      });

      expect(fetchMock.mock.calls[0][0]).toBe("https://gitlab.example.com/api/v4/projects/g%2Fp");
    });

    it("builds an authenticated clone URL for self-hosted instances", () => {
      expect(
        provider.getAuthenticatedCloneUrl({
          baseUrl: "https://gitlab.example.com",
          repoIdentifier: "g/p",
          token: "glpat",
        }),
      ).toBe("https://oauth2:glpat@gitlab.example.com/g/p.git");
    });

    it("accepts a Git clone suffix without sending it to the API twice", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ default_branch: "main", web_url: "x" }));

      await provider.validateConnection({
        baseUrl: null,
        repoIdentifier: "group/project.git",
        token: "glpat",
      });

      expect(fetchMock.mock.calls[0][0]).toBe("https://gitlab.com/api/v4/projects/group%2Fproject");
    });

    it("creates a merge request", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ web_url: "https://gitlab.com/g/p/-/merge_requests/1", iid: 1 }),
      );

      const mr = await provider.createPullRequest(
        { baseUrl: null, repoIdentifier: "g/p", token: "glpat" },
        { sourceBranch: "fix", targetBranch: "main", title: "t", body: "b" },
      );

      expect(mr.url).toContain("/merge_requests/1");
      expect(mr.id).toBe("1");
      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        source_branch: "fix",
        target_branch: "main",
        title: "t",
        description: "b",
      });
    });

    it("squash-merges a merge request and removes the source branch", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ state: "merged" }));

      await provider.mergePullRequest(
        { baseUrl: null, repoIdentifier: "g/p", token: "glpat" },
        "8",
      );

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://gitlab.com/api/v4/projects/g%2Fp/merge_requests/8/merge");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toEqual({ squash: true, should_remove_source_branch: true });
    });

    it("reads the latest pipeline of the commit", async () => {
      fetchMock.mockResolvedValue(jsonResponse([{ id: 42, status: "running" }]));

      const checks = await provider.getCommitChecks(
        { baseUrl: null, repoIdentifier: "group/repo", token: "tok" },
        "abc1234",
      );

      expect(checks).toEqual({ state: "pending", total: 1, failed: [], pending: ["Pipeline #42"] });
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://gitlab.com/api/v4/projects/group%2Frepo/pipelines?sha=abc1234&order_by=id&sort=desc&per_page=1",
      );
    });

    it("treats a commit without pipeline as unverified", async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));

      await expect(
        provider.getCommitChecks(
          { baseUrl: null, repoIdentifier: "group/repo", token: "tok" },
          "abc1234",
        ),
      ).resolves.toMatchObject({ state: "none", total: 0 });
    });

    it("maps errors to VcsRequestError", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ message: "404" }, 404));

      await expect(
        provider.validateConnection({
          baseUrl: null,
          repoIdentifier: "g/p",
          token: "glpat",
        }),
      ).rejects.toBeInstanceOf(VcsRequestError);
    });
  });
});
