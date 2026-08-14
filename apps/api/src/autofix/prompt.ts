import type { ResolvedFrame } from "../artifacts/sourcemap-resolver.service";
import { getPrimaryException } from "../common/grouping";

const MAX_SECTION_BYTES = 50_000;

function truncate(value: string, maxBytes = MAX_SECTION_BYTES): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) {
    return value;
  }

  return `${value.slice(0, maxBytes)}\n… [truncated]`;
}

function formatFrames(frames: ResolvedFrame[]): string {
  if (frames.length === 0) {
    return "(no stack trace available)";
  }

  return frames
    .map((frame) => {
      const location = `${frame.filename}:${frame.lineno}${frame.colno != null ? `:${frame.colno}` : ""}`;
      return `  at ${frame.function ?? "<anonymous>"} (${location})${frame.resolved ? "" : " [unresolved]"}`;
    })
    .join("\n");
}

export const AUTOFIX_SYSTEM_PROMPT = `You are a senior software engineer fixing a production bug reported by SpicyTrack, an error-tracking system. You are working inside a shallow clone of the project's repository.

How to work:
- Start by locating the faulty code: use the code-graph tools (search_graph, search_code, get_code_snippet, trace_path) to navigate the codebase efficiently, then read_file to inspect the exact code before changing anything.
- Make the smallest, most targeted change that fixes the root cause of the error. Do not refactor, reformat, rename, or "improve" unrelated code. Match the existing code style.
- Only validate at real boundaries; do not add speculative error handling around code that cannot fail.
- Write complete file contents with write_file when you edit a file.
- When the fix is complete, call report_fix exactly once with a clear summary (it becomes the pull-request description) and the list of changed files, then stop.
- If you conclude the bug cannot be fixed from this repository (e.g. the error originates in a dependency or the stack trace does not match this codebase), call report_fix with an explanation and an empty files_changed list, without editing anything.`;

export function buildTaskPrompt(input: {
  issue: {
    title: string;
    culprit: string | null;
    level: string;
    timesSeen: number;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
  };
  event: {
    message: string | null;
    rawPayload: Record<string, unknown>;
  };
  resolvedFrames: ResolvedFrame[];
}): string {
  const exception = getPrimaryException(input.event.rawPayload);
  const tags = input.event.rawPayload.tags;
  const contexts = input.event.rawPayload.contexts;

  const sections = [
    `Fix the following production error.`,
    `## Issue
Title: ${input.issue.title}
Culprit: ${input.issue.culprit ?? "unknown"}
Level: ${input.issue.level}
Occurrences: ${input.issue.timesSeen}`,
    `## Exception
Type: ${exception?.type ?? "unknown"}
Message: ${exception?.value ?? input.event.message ?? "unknown"}`,
    `## Stack trace (most recent call last)
${truncate(formatFrames(input.resolvedFrames))}`,
  ];

  if (tags && Object.keys(tags as object).length > 0) {
    sections.push(`## Tags\n${truncate(JSON.stringify(tags, null, 2), 5_000)}`);
  }

  if (contexts && Object.keys(contexts as object).length > 0) {
    sections.push(`## Contexts\n${truncate(JSON.stringify(contexts, null, 2), 10_000)}`);
  }

  sections.push("Investigate the repository, apply the fix, then call report_fix.");

  return sections.join("\n\n");
}
