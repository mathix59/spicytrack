import {
  TicketProviderError,
  assertJiraBaseUrl,
  createJiraIssue,
  createLinearIssue,
  findJiraIssueType,
  findLinearTeam,
  markdownToAdf,
  markdownToJiraWiki,
} from "./ticket-providers";

describe("ticket providers", () => {
  const fetchMock = jest.fn();
  const jsonResponse = (body: unknown, status = 200) => ({
    ok: status < 400,
    status,
    text: async () => JSON.stringify(body),
  });
  const sent = (call = 0) => {
    const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
    return {
      url,
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined,
      redirect: init.redirect,
    };
  };

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.LINEAR_API_URL;
    delete process.env.ALLOW_PRIVATE_WEBHOOK_URLS;
  });

  describe("Linear", () => {
    it("finds a team by key and sends the API key as is", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          data: { teams: { nodes: [{ id: "t1", key: "ENG", name: "Engineering" }] } },
        }),
      );
      await expect(findLinearTeam("lin_api_x", "eng")).resolves.toEqual({
        id: "t1",
        key: "ENG",
        name: "Engineering",
      });
      expect(sent().url).toBe("https://api.linear.app/graphql");
      expect(sent().headers.Authorization).toBe("lin_api_x");
      expect(sent().body.variables).toEqual({ key: "eng" });
      expect(sent().redirect).toBe("error");
    });

    it("reports an unknown team and GraphQL errors", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { teams: { nodes: [] } } }));
      await expect(findLinearTeam("k", "NOPE")).rejects.toThrow("No Linear team has the key NOPE");

      fetchMock.mockResolvedValueOnce(
        jsonResponse({ errors: [{ message: "Authentication required" }] }, 400),
      );
      const error = await findLinearTeam("bad", "ENG").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(TicketProviderError);
      expect(error).toMatchObject({ status: 400 });
      expect((error as Error).message).toContain("Authentication required");
    });

    it("creates an issue in the team", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          data: {
            issueCreate: {
              success: true,
              issue: { identifier: "ENG-12", url: "https://linear.app/acme/issue/ENG-12" },
            },
          },
        }),
      );
      await expect(
        createLinearIssue("k", "t1", { title: "TypeError", description: "**error**" }),
      ).resolves.toEqual({ externalKey: "ENG-12", url: "https://linear.app/acme/issue/ENG-12" });
      expect(sent().body.variables.input).toEqual({
        teamId: "t1",
        title: "TypeError",
        description: "**error**",
      });
    });

    it("turns network failures into an unreachable error", async () => {
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));
      await expect(findLinearTeam("k", "ENG")).rejects.toMatchObject({
        status: null,
        message: expect.stringContaining("Linear could not be reached"),
      });
    });
  });

  describe("Jira", () => {
    const cloud = { baseUrl: "https://acme.atlassian.net", email: "me@acme.test", token: "tok" };
    const dataCenter = { baseUrl: "https://jira.acme.test", email: null, token: "pat" };

    it("uses REST v3 with basic auth on Cloud and matches the issue type", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({
          key: "OPS",
          issueTypes: [
            { name: "Bug", subtask: false },
            { name: "Sub-task", subtask: true },
          ],
        }),
      );
      await expect(findJiraIssueType(cloud, "ops", "bug")).resolves.toEqual({
        projectKey: "OPS",
        issueType: "Bug",
      });
      expect(sent().url).toBe("https://acme.atlassian.net/rest/api/3/project/ops");
      expect(sent().headers.Authorization).toBe(
        `Basic ${Buffer.from("me@acme.test:tok").toString("base64")}`,
      );
      await expect(findJiraIssueType(cloud, "OPS", "Sub-task")).rejects.toThrow(
        'Jira project OPS has no "Sub-task" issue type. Available: Bug.',
      );
    });

    it("creates Cloud issues with an ADF description and Data Center ones with wiki text", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: "1", key: "OPS-7" }));
      const ticket = { title: "Boom", description: "See [issue](https://st.test/i/1)" };
      await expect(
        createJiraIssue(cloud, { projectKey: "OPS", issueType: "Bug" }, ticket),
      ).resolves.toEqual({ externalKey: "OPS-7", url: "https://acme.atlassian.net/browse/OPS-7" });
      expect(sent(0).url).toBe("https://acme.atlassian.net/rest/api/3/issue");
      expect(sent(0).body.fields).toMatchObject({
        project: { key: "OPS" },
        issuetype: { name: "Bug" },
        summary: "Boom",
        description: { type: "doc", version: 1 },
      });

      await createJiraIssue(dataCenter, { projectKey: "OPS", issueType: "Bug" }, ticket);
      expect(sent(1).url).toBe("https://jira.acme.test/rest/api/2/issue");
      expect(sent(1).headers.Authorization).toBe("Bearer pat");
      expect(sent(1).body.fields.description).toBe("See [issue|https://st.test/i/1]");
    });

    it("explains Jira field errors", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { errorMessages: [], errors: { issuetype: "Specify a valid issue type" } },
          400,
        ),
      );
      await expect(
        createJiraIssue(
          cloud,
          { projectKey: "OPS", issueType: "Bug" },
          { title: "t", description: "" },
        ),
      ).rejects.toThrow("Jira returned HTTP 400: issuetype: Specify a valid issue type");
    });

    it("only accepts public HTTPS site addresses", async () => {
      await expect(assertJiraBaseUrl("https://93.184.215.14/jira/")).resolves.toBe(
        "https://93.184.215.14/jira",
      );
      await expect(assertJiraBaseUrl("http://jira.acme.test")).rejects.toThrow("HTTPS");
      await expect(assertJiraBaseUrl("https://127.0.0.1")).rejects.toThrow("Private Jira");
      await expect(assertJiraBaseUrl("https://10.0.0.8")).rejects.toThrow("Private Jira");
      await expect(assertJiraBaseUrl("https://jira")).rejects.toThrow("Private Jira");
      await expect(assertJiraBaseUrl("https://u:p@acme.atlassian.net")).rejects.toThrow(
        "Jira site address",
      );
      process.env.ALLOW_PRIVATE_WEBHOOK_URLS = "true";
      await expect(assertJiraBaseUrl("http://127.0.0.1:4700")).resolves.toBe(
        "http://127.0.0.1:4700",
      );
    });
  });

  describe("Markdown conversion", () => {
    const markdown = [
      "**error** in api, see [the issue](https://st.test/i/1).",
      "Culprit: `charge`",
      "",
      "```",
      "TypeError: boom",
      "    at charge (src/pay.ts:3)",
      "```",
    ].join("\n");

    it("builds ADF paragraphs, marks and code blocks", () => {
      expect(markdownToAdf(markdown)).toEqual({
        type: "doc",
        version: 1,
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "error", marks: [{ type: "strong" }] },
              { type: "text", text: " in api, see " },
              {
                type: "text",
                text: "the issue",
                marks: [{ type: "link", attrs: { href: "https://st.test/i/1" } }],
              },
              { type: "text", text: "." },
              { type: "hardBreak" },
              { type: "text", text: "Culprit: " },
              { type: "text", text: "charge", marks: [{ type: "code" }] },
            ],
          },
          {
            type: "codeBlock",
            content: [{ type: "text", text: "TypeError: boom\n    at charge (src/pay.ts:3)" }],
          },
        ],
      });
    });

    it("builds Jira wiki markup", () => {
      expect(markdownToJiraWiki(markdown)).toBe(
        [
          "*error* in api, see [the issue|https://st.test/i/1].",
          "Culprit: {{charge}}",
          "",
          "{noformat}",
          "TypeError: boom",
          "    at charge (src/pay.ts:3)",
          "{noformat}",
        ].join("\n"),
      );
    });
  });
});
