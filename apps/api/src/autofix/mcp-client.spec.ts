import { CodebaseMemoryMcp } from "./mcp-client";

describe("CodebaseMemoryMcp", () => {
  it("exposes no graph tools when the optional MCP process is unavailable", async () => {
    const previous = process.env.CODEBASE_MEMORY_MCP_BIN;
    process.env.CODEBASE_MEMORY_MCP_BIN = "spicytrack-missing-codebase-memory-mcp";
    const mcp = new CodebaseMemoryMcp();

    try {
      await expect(mcp.connect()).resolves.toBe(false);
      await expect(mcp.listTools()).resolves.toEqual([]);
    } finally {
      await mcp.close();
      if (previous === undefined) delete process.env.CODEBASE_MEMORY_MCP_BIN;
      else process.env.CODEBASE_MEMORY_MCP_BIN = previous;
    }
  });
});
