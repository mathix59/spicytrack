import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

async function commandExists(command: string): Promise<boolean> {
  const candidates = command.includes(path.sep)
    ? [command]
    : (process.env.PATH ?? "")
        .split(path.delimiter)
        .filter(Boolean)
        .map((directory) => path.join(directory, command));

  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return true;
    } catch {
      // Try the next PATH entry.
    }
  }

  return false;
}

export class CodebaseMemoryMcp {
  private client: Client | null = null;

  async connect(): Promise<boolean> {
    const command = process.env.CODEBASE_MEMORY_MCP_BIN ?? "codebase-memory-mcp";
    if (!(await commandExists(command))) return false;

    const transport = new StdioClientTransport({ command, args: [] });

    const client = new Client({ name: "spicytrack-autofix", version: "1.0.0" });

    try {
      await client.connect(transport);
      this.client = client;
      return true;
    } catch {
      await client.close().catch(() => undefined);
      this.client = null;
      return false;
    }
  }

  async listTools(): Promise<McpToolDefinition[]> {
    if (!this.client) return [];

    const result = await this.client.listTools();

    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? tool.name,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    const result = await this.requireClient().callTool({
      name,
      arguments: args,
    });

    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
      .map((block) => (block.type === "text" ? block.text : JSON.stringify(block)))
      .join("\n");

    if (result.isError) {
      throw new Error(text || `MCP tool ${name} failed`);
    }

    return text;
  }

  async close(): Promise<void> {
    await this.client?.close().catch(() => undefined);
    this.client = null;
  }

  private requireClient(): Client {
    if (!this.client) {
      throw new Error("MCP client is not connected");
    }

    return this.client;
  }
}
