import { auditedArguments } from "./mcp.service";

describe("auditedArguments", () => {
  it("keeps identifiers and filters, truncates long text and hides comment bodies", () => {
    expect(
      auditedArguments({
        projectId: "p",
        limit: 10,
        confirmed: true,
        query: "x".repeat(250),
        body: "Customer says the card was charged twice",
        tags: { browser: "Chrome" },
      }),
    ).toEqual({
      projectId: "p",
      limit: 10,
      confirmed: true,
      query: `${"x".repeat(200)}…`,
      body: "[40 characters]",
      tags: '{"browser":"Chrome"}',
    });
  });
});
