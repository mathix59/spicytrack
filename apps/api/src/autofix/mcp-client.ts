import { execFile as execFileCallback } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const DEFAULT_COMMAND = "codebase-memory-mcp";
const DEFAULT_INSTALL_PREFIX = "/tmp/codebase-memory-mcp";
const execFile = promisify(execFileCallback);

function getMcpCommand(): string {
  return process.env.CODEBASE_MEMORY_MCP_BIN ?? DEFAULT_COMMAND;
}

function getMcpPackage(): string {
  return process.env.CODEBASE_MEMORY_MCP_NPM_PACKAGE ?? getMcpCommand();
}

function getMcpInstallPrefix(): string {
  return process.env.CODEBASE_MEMORY_MCP_INSTALL_PREFIX ?? DEFAULT_INSTALL_PREFIX;
}

function shouldAutoInstall(): boolean {
  return process.env.CODEBASE_MEMORY_MCP_AUTO_INSTALL !== "false";
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

async function installCodebaseMemoryMcp(): Promise<string | null> {
  if (!shouldAutoInstall()) return null;
  const command = getMcpCommand();
  if (command.includes(path.sep)) return null;

  const binaryName = getMcpPackage();
  const binaryPath = path.join(getMcpInstallPrefix(), "bin", binaryName);
  if (await commandExists(binaryPath)) {
    return binaryPath;
  }

  try {
    await execFile(
      "npm",
      ["install", "--global", getMcpPackage(), "--prefix", getMcpInstallPrefix()],
      {
        env: {
          ...process.env,
          NPM_CONFIG_AUDIT: "false",
          NPM_CONFIG_FUND: "false",
        },
      },
    );
  } catch {
    return null;
  }

  return (await commandExists(binaryPath)) ? binaryPath : null;
}

export class CodebaseMemoryMcp {
  private client: Client | null = null;

  async connect(): Promise<boolean> {
    const command = await (async () => {
      const configured = getMcpCommand();

      if (await commandExists(configured)) {
        return configured;
      }

      return await installCodebaseMemoryMcp();
    })();

    if (!command) return false;

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
