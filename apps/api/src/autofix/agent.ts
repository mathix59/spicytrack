import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, jsonSchema, stepCountIs, tool } from "ai";
import type { LanguageModel, ToolSet } from "ai";
import { CodebaseMemoryMcp } from "./mcp-client";
import { AUTOFIX_SYSTEM_PROMPT } from "./prompt";

export type AiProvider = "anthropic" | "openai" | "google";

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.4",
  google: "gemini-3.5-flash",
};

const MCP_QUERY_TOOLS = new Set(["search_graph", "trace_path", "get_code_snippet", "search_code"]);

const MAX_STEPS = 40;
const MAX_FILE_BYTES = 200_000;

export interface AgentResult {
  summary: string;
  filesChanged: string[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function resolveModel(input: {
  provider: AiProvider;
  model: string | null;
  apiKey: string;
}): LanguageModel {
  const modelId = input.model ?? DEFAULT_MODELS[input.provider];

  switch (input.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: input.apiKey })(modelId);
    case "openai":
      return createOpenAI({ apiKey: input.apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: input.apiKey })(modelId);
  }
}

function resolveInRepo(repoDir: string, relativePath: string): string {
  const resolved = path.resolve(repoDir, relativePath);

  if (resolved !== repoDir && !resolved.startsWith(`${repoDir}${path.sep}`)) {
    throw new Error(`Path escapes the repository: ${relativePath}`);
  }

  if (resolved.split(path.sep).includes(".git")) {
    throw new Error("Access to .git is not allowed");
  }

  return resolved;
}

export async function runAutofixAgent(input: {
  model: LanguageModel;
  repoDir: string;
  mcp: CodebaseMemoryMcp;
  taskPrompt: string;
}): Promise<AgentResult> {
  const { repoDir, mcp } = input;

  let reported: { summary: string; filesChanged: string[] } | null = null;

  const tools: ToolSet = {};

  for (const mcpTool of await mcp.listTools()) {
    if (!MCP_QUERY_TOOLS.has(mcpTool.name)) {
      continue;
    }

    tools[mcpTool.name] = tool({
      description: mcpTool.description,
      inputSchema: jsonSchema(mcpTool.inputSchema as never),
      execute: async (toolInput) =>
        mcp.callTool(mcpTool.name, toolInput as Record<string, unknown>),
    });
  }

  tools.read_file = tool({
    description: "Read a file from the repository. Path is relative to the repository root.",
    inputSchema: jsonSchema<{ path: string }>({
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path" },
      },
      required: ["path"],
      additionalProperties: false,
    }),
    execute: async ({ path: relativePath }) => {
      const content = await readFile(resolveInRepo(repoDir, relativePath), "utf8");

      if (content.length > MAX_FILE_BYTES) {
        return `${content.slice(0, MAX_FILE_BYTES)}\n… [truncated]`;
      }

      return content;
    },
  });

  tools.write_file = tool({
    description:
      "Write the complete new content of a file in the repository. Creates the file (and parent directories) if missing. Path is relative to the repository root.",
    inputSchema: jsonSchema<{ path: string; content: string }>({
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path" },
        content: { type: "string", description: "Full file content" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    }),
    execute: async ({ path: relativePath, content }) => {
      const target = resolveInRepo(repoDir, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
      return `Wrote ${relativePath}`;
    },
  });

  tools.list_dir = tool({
    description:
      "List files and directories at a path relative to the repository root. Defaults to the root.",
    inputSchema: jsonSchema<{ path?: string }>({
      type: "object",
      properties: {
        path: { type: "string", description: "Relative directory path" },
      },
      additionalProperties: false,
    }),
    execute: async ({ path: relativePath }) => {
      const target = resolveInRepo(repoDir, relativePath ?? ".");
      const entries = await readdir(target, { withFileTypes: true });

      return entries
        .filter((entry) => entry.name !== ".git")
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .join("\n");
    },
  });

  tools.report_fix = tool({
    description:
      "Report the completed fix. Call exactly once when you are done. The summary becomes the pull-request description.",
    inputSchema: jsonSchema<{ summary: string; files_changed: string[] }>({
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Explanation of the root cause and the fix, in Markdown.",
        },
        files_changed: {
          type: "array",
          items: { type: "string" },
          description: "Relative paths of the files you changed.",
        },
      },
      required: ["summary", "files_changed"],
      additionalProperties: false,
    }),
    execute: async ({ summary, files_changed }) => {
      reported = { summary, filesChanged: files_changed };
      return "Fix recorded. You can stop now.";
    },
  });

  const result = await generateText({
    model: input.model,
    system: AUTOFIX_SYSTEM_PROMPT,
    prompt: input.taskPrompt,
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
  });

  if (!reported) {
    throw new Error("The agent finished without calling report_fix; aborting the run.");
  }

  const { summary, filesChanged } = reported as {
    summary: string;
    filesChanged: string[];
  };

  return {
    summary,
    filesChanged,
    inputTokens: result.totalUsage.inputTokens ?? 0,
    outputTokens: result.totalUsage.outputTokens ?? 0,
    cacheReadTokens: result.totalUsage.inputTokenDetails.cacheReadTokens ?? 0,
    cacheWriteTokens: result.totalUsage.inputTokenDetails.cacheWriteTokens ?? 0,
  };
}
