import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, jsonSchema, stepCountIs, tool } from "ai";
import type { LanguageModel, StopCondition, ToolSet } from "ai";
import { CodebaseMemoryMcp } from "./mcp-client";
import { ANALYSIS_SYSTEM_PROMPT, AUTOFIX_SYSTEM_PROMPT } from "./prompt";

export type AiProvider = "anthropic" | "openai" | "google";

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-sonnet-5",
  openai: "gpt-5.4",
  google: "gemini-3.5-flash",
};

const MCP_QUERY_TOOLS = new Set(["search_graph", "trace_path", "get_code_snippet", "search_code"]);

const MAX_STEPS = 40;
const MAX_FILE_BYTES = 200_000;
// Per model call; a step that rewrites a large file still fits.
const MAX_OUTPUT_TOKENS = 32_000;

/** Paths the agent may read but never write: CI, hooks, dependency locks. */
const PROTECTED_WRITE_PATTERNS = [
  /^\.github\//,
  /^\.gitlab\//,
  /^\.gitlab-ci\.ya?ml$/,
  /^\.circleci\//,
  /^\.buildkite\//,
  /^\.husky\//,
  /^\.gitmodules$/,
  /^\.gitattributes$/,
  /(^|\/)Jenkinsfile$/,
  /(^|\/)azure-pipelines\.ya?ml$/,
  /(^|\/)\.travis\.ya?ml$/,
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|Gemfile\.lock|poetry\.lock|composer\.lock|go\.sum|uv\.lock)$/,
];

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface RootCauseAnalysis {
  rootCause: string;
  proposedFix: string;
  confidence: "low" | "medium" | "high";
  fixable: boolean;
  files: string[];
}

export interface AgentResult extends TokenUsage {
  summary: string;
  filesChanged: string[];
  analysis: RootCauseAnalysis | null;
  /** The run stopped because the next step could exceed its spending limit. */
  stoppedForBudget: boolean;
}

/** Spending limit of one agent run, checked after every model call. */
export interface AgentSpendLimit {
  limitMicros: number;
  estimateCostMicros: (usage: TokenUsage) => Promise<number | null>;
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

function isInside(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

/** Closest existing ancestor, so paths of files about to be created can be checked too. */
async function realpathOfExisting(target: string): Promise<string> {
  try {
    return await realpath(target);
  } catch (error) {
    const parent = path.dirname(target);

    if ((error as NodeJS.ErrnoException).code !== "ENOENT" || parent === target) {
      throw error;
    }

    return path.join(await realpathOfExisting(parent), path.basename(target));
  }
}

/**
 * Resolves a model-supplied path inside the clone. Symlinks are followed before the check, so a
 * link committed in the repository cannot expose files of the host.
 */
export async function resolveInRepo(repoDir: string, relativePath: string): Promise<string> {
  const root = await realpath(repoDir);
  const resolved = path.resolve(root, relativePath);

  if (!isInside(root, resolved)) {
    throw new Error(`Path escapes the repository: ${relativePath}`);
  }

  const real = await realpathOfExisting(resolved);

  if (!isInside(root, real)) {
    throw new Error(`Path escapes the repository: ${relativePath}`);
  }

  if (path.relative(root, real).split(path.sep).includes(".git")) {
    throw new Error("Access to .git is not allowed");
  }

  return real;
}

export async function resolveWritableInRepo(
  repoDir: string,
  relativePath: string,
): Promise<{ absolute: string; relative: string }> {
  const absolute = await resolveInRepo(repoDir, relativePath);
  const relative = path
    .relative(await realpath(repoDir), absolute)
    .split(path.sep)
    .join("/");

  if (PROTECTED_WRITE_PATTERNS.some((pattern) => pattern.test(relative))) {
    throw new Error(`Autofix cannot modify ${relative}: CI, hooks and lockfiles are protected.`);
  }

  return { absolute, relative };
}

export function sumUsage(
  steps: ReadonlyArray<{
    usage: {
      inputTokens?: number;
      outputTokens?: number;
      inputTokenDetails?: { cacheReadTokens?: number; cacheWriteTokens?: number };
    };
  }>,
): TokenUsage {
  return steps.reduce<TokenUsage>(
    (total, step) => ({
      inputTokens: total.inputTokens + (step.usage.inputTokens ?? 0),
      outputTokens: total.outputTokens + (step.usage.outputTokens ?? 0),
      cacheReadTokens: total.cacheReadTokens + (step.usage.inputTokenDetails?.cacheReadTokens ?? 0),
      cacheWriteTokens:
        total.cacheWriteTokens + (step.usage.inputTokenDetails?.cacheWriteTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
  );
}

const CONFIDENCE = ["low", "medium", "high"] as const;

/**
 * Runs the agent in one of two modes. `analysis` is read-only and ends with report_analysis;
 * `fix` may write files and ends with report_fix.
 */
export async function runAutofixAgent(input: {
  mode: "analysis" | "fix";
  model: LanguageModel;
  repoDir: string;
  mcp: CodebaseMemoryMcp;
  taskPrompt: string;
  abortSignal?: AbortSignal;
  spendLimit?: AgentSpendLimit | null;
}): Promise<AgentResult> {
  const { repoDir, mcp } = input;

  let reported: { summary: string } | null = null;
  let analysis: RootCauseAnalysis | null = null;
  let stoppedForBudget = false;
  // The commit is built from what the agent actually wrote, not from what it reports.
  const written = new Set<string>();

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
      const content = await readFile(await resolveInRepo(repoDir, relativePath), "utf8");

      if (content.length > MAX_FILE_BYTES) {
        return `${content.slice(0, MAX_FILE_BYTES)}\n… [truncated]`;
      }

      return content;
    },
  });

  if (input.mode === "fix") {
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
        const target = await resolveWritableInRepo(repoDir, relativePath);
        await mkdir(path.dirname(target.absolute), { recursive: true });
        await writeFile(target.absolute, content, "utf8");
        written.add(target.relative);
        return `Wrote ${target.relative}`;
      },
    });
  }

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
      const target = await resolveInRepo(repoDir, relativePath ?? ".");
      const entries = await readdir(target, { withFileTypes: true });

      return entries
        .filter((entry) => entry.name !== ".git")
        .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
        .join("\n");
    },
  });

  if (input.mode === "fix") {
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
      execute: async ({ summary }) => {
        reported = { summary };
        return "Fix recorded. You can stop now.";
      },
    });
  } else {
    tools.report_analysis = tool({
      description:
        "Report the root-cause analysis. Call exactly once when you are done; do not propose a patch here.",
      inputSchema: jsonSchema<{
        root_cause: string;
        proposed_fix: string;
        confidence: "low" | "medium" | "high";
        fixable: boolean;
        files: string[];
      }>({
        type: "object",
        properties: {
          root_cause: {
            type: "string",
            description:
              "Why the error happens, in Markdown, citing the files and lines you read as evidence.",
          },
          proposed_fix: {
            type: "string",
            description: "The smallest change that would fix it, in Markdown. No full patch.",
          },
          confidence: { type: "string", enum: [...CONFIDENCE] },
          fixable: {
            type: "boolean",
            description: "False when the fix does not belong in this repository.",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Relative paths of the files a fix would change.",
          },
        },
        required: ["root_cause", "proposed_fix", "confidence", "fixable", "files"],
        additionalProperties: false,
      }),
      execute: async (report) => {
        analysis = {
          rootCause: report.root_cause.slice(0, 20_000),
          proposedFix: report.proposed_fix.slice(0, 20_000),
          confidence: CONFIDENCE.includes(report.confidence) ? report.confidence : "low",
          fixable: Boolean(report.fixable),
          files: report.files.slice(0, 50).map((file) => String(file).slice(0, 500)),
        };
        return "Analysis recorded. You can stop now.";
      },
    });
  }

  const stopForBudget: StopCondition<ToolSet> = async ({ steps }) => {
    if (!input.spendLimit) return false;
    const spent = await input.spendLimit.estimateCostMicros(sumUsage(steps));
    stoppedForBudget = spent !== null && spent >= input.spendLimit.limitMicros;
    return stoppedForBudget;
  };

  const result = await generateText({
    model: input.model,
    system: input.mode === "fix" ? AUTOFIX_SYSTEM_PROMPT : ANALYSIS_SYSTEM_PROMPT,
    prompt: input.taskPrompt,
    tools,
    stopWhen: [stepCountIs(MAX_STEPS), stopForBudget],
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: input.abortSignal,
  });
  const usage = sumUsage(result.steps);

  if (!stoppedForBudget) {
    if (input.mode === "fix" && !reported) {
      throw new Error("The agent finished without calling report_fix; aborting the run.");
    }
    if (input.mode === "analysis" && !analysis) {
      throw new Error("The agent finished without calling report_analysis; aborting the run.");
    }
  }

  const finalAnalysis = analysis as RootCauseAnalysis | null;
  return {
    summary: (reported as { summary: string } | null)?.summary ?? finalAnalysis?.rootCause ?? "",
    filesChanged: [...written],
    analysis: finalAnalysis,
    stoppedForBudget,
    ...usage,
  };
}
