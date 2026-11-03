import { isIP } from "node:net";
import { BadRequestException } from "@nestjs/common";
import { assertSafeWebhookUrl } from "../alerts/webhook-url-policy";

/** A tracker refused the request, or could not be reached. */
export class TicketProviderError extends Error {
  constructor(
    /** HTTP status from the tracker; null when it could not be reached. */
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

export type CreatedTicket = { externalKey: string; url: string };

const REQUEST_TIMEOUT_MS = 15_000;

async function requestJson<T>(
  provider: string,
  url: string,
  init: { method: string; headers: Record<string, string>; body?: unknown },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (error) {
    throw new TicketProviderError(
      null,
      `${provider} could not be reached: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Kept as text in the error below.
  }
  if (!response.ok) {
    throw new TicketProviderError(
      response.status,
      `${provider} returned HTTP ${response.status}: ${providerErrorMessage(json) ?? text.slice(0, 300)}`,
    );
  }
  return json as T;
}

function providerErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const record = json as Record<string, unknown>;
  // Linear: { errors: [{ message }] }. Jira: { errorMessages: [], errors: { field: message } }.
  if (Array.isArray(record.errors)) {
    const messages = record.errors
      .map((error) => (error as { message?: unknown })?.message)
      .filter((message): message is string => typeof message === "string");
    if (messages.length > 0) return messages.join("; ").slice(0, 300);
  }
  const parts = [
    ...(Array.isArray(record.errorMessages) ? record.errorMessages : []),
    ...(record.errors && typeof record.errors === "object" && !Array.isArray(record.errors)
      ? Object.entries(record.errors as Record<string, unknown>).map(
          ([field, message]) => `${field}: ${String(message)}`,
        )
      : []),
  ].filter((part): part is string => typeof part === "string" && part.length > 0);
  return parts.length > 0 ? parts.join("; ").slice(0, 300) : null;
}

// ---------------------------------------------------------------------------------------------
// Linear

const linearApiUrl = () => process.env.LINEAR_API_URL ?? "https://api.linear.app/graphql";

async function linearQuery<T>(apiKey: string, query: string, variables: Record<string, unknown>) {
  const result = await requestJson<{ data?: T; errors?: Array<{ message?: string }> }>(
    "Linear",
    linearApiUrl(),
    // Personal API keys are sent as is; OAuth tokens would need "Bearer".
    { method: "POST", headers: { Authorization: apiKey }, body: { query, variables } },
  );
  if (result?.errors?.length || !result?.data) {
    throw new TicketProviderError(
      200,
      `Linear refused the request: ${providerErrorMessage(result) ?? "no data returned"}`,
    );
  }
  return result.data;
}

export type LinearTeam = { id: string; key: string; name: string };

export async function findLinearTeam(apiKey: string, teamKey: string): Promise<LinearTeam> {
  const data = await linearQuery<{ teams: { nodes: LinearTeam[] } }>(
    apiKey,
    `query SpicyTrackTeam($key: String!) {
      teams(filter: { key: { eqIgnoreCase: $key } }) { nodes { id key name } }
    }`,
    { key: teamKey },
  );
  const team = data.teams.nodes[0];
  if (!team) {
    throw new TicketProviderError(404, `No Linear team has the key ${teamKey}.`);
  }
  return team;
}

export async function createLinearIssue(
  apiKey: string,
  teamId: string,
  ticket: { title: string; description: string },
): Promise<CreatedTicket> {
  const data = await linearQuery<{
    issueCreate: { success: boolean; issue: { identifier: string; url: string } | null };
  }>(
    apiKey,
    `mutation SpicyTrackIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { identifier url } }
    }`,
    { input: { teamId, title: ticket.title, description: ticket.description } },
  );
  if (!data.issueCreate.success || !data.issueCreate.issue) {
    throw new TicketProviderError(200, "Linear did not create the issue.");
  }
  return { externalKey: data.issueCreate.issue.identifier, url: data.issueCreate.issue.url };
}

// ---------------------------------------------------------------------------------------------
// Jira

export type JiraConnection = {
  baseUrl: string;
  /** Jira Cloud: email and API token (REST v3). Data Center: personal access token (REST v2). */
  email: string | null;
  token: string;
};

/** Normalizes a Jira site URL, refusing private destinations like alert webhooks do. */
export async function assertJiraBaseUrl(value: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException("baseUrl must be a valid URL");
  }
  const allowPrivate = process.env.ALLOW_PRIVATE_WEBHOOK_URLS === "true";
  if (url.protocol !== "https:" && !(allowPrivate && url.protocol === "http:")) {
    throw new BadRequestException("baseUrl must use HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new BadRequestException(
      "baseUrl must be the Jira site address, like https://acme.atlassian.net",
    );
  }
  if (!allowPrivate && isIP(url.hostname) === 0 && !url.hostname.includes(".")) {
    throw new BadRequestException("Private Jira addresses are not allowed");
  }
  try {
    await assertSafeWebhookUrl(url.toString());
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw new BadRequestException(
        error.message.replace(/webhook (destinations|hostname)/i, "Jira $1"),
      );
    }
    throw error;
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

function jiraRequest<T>(connection: JiraConnection, method: string, path: string, body?: unknown) {
  const version = connection.email ? 3 : 2;
  const authorization = connection.email
    ? `Basic ${Buffer.from(`${connection.email}:${connection.token}`).toString("base64")}`
    : `Bearer ${connection.token}`;
  return requestJson<T>("Jira", `${connection.baseUrl}/rest/api/${version}${path}`, {
    method,
    headers: { Authorization: authorization },
    body,
  });
}

/** Checks the project exists and returns the issue type's exact name. */
export async function findJiraIssueType(
  connection: JiraConnection,
  projectKey: string,
  issueType: string,
): Promise<{ projectKey: string; issueType: string }> {
  const project = await jiraRequest<{
    key: string;
    issueTypes?: Array<{ name: string; subtask?: boolean }>;
  }>(connection, "GET", `/project/${encodeURIComponent(projectKey)}`);
  const types = (project.issueTypes ?? []).filter((type) => !type.subtask);
  const match = types.find((type) => type.name.toLowerCase() === issueType.toLowerCase());
  if (!match) {
    throw new TicketProviderError(
      404,
      `Jira project ${project.key} has no "${issueType}" issue type. Available: ${
        types.map((type) => type.name).join(", ") || "none"
      }.`,
    );
  }
  return { projectKey: project.key, issueType: match.name };
}

export async function createJiraIssue(
  connection: JiraConnection,
  target: { projectKey: string; issueType: string },
  ticket: { title: string; description: string },
): Promise<CreatedTicket> {
  const created = await jiraRequest<{ key: string }>(connection, "POST", "/issue", {
    fields: {
      project: { key: target.projectKey },
      issuetype: { name: target.issueType },
      // Jira rejects summaries over 255 characters.
      summary: ticket.title.replace(/\s+/g, " ").slice(0, 255),
      description: connection.email
        ? markdownToAdf(ticket.description)
        : markdownToJiraWiki(ticket.description),
    },
  });
  return { externalKey: created.key, url: `${connection.baseUrl}/browse/${created.key}` };
}

// ---------------------------------------------------------------------------------------------
// Markdown subset used by ticket drafts: paragraphs, fenced code blocks, and [links](https://…).

type Block = { kind: "code"; text: string } | { kind: "paragraph"; lines: string[] };

function markdownBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trimStart().startsWith("```")) {
      flush();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
        code.push(lines[index]);
        index += 1;
      }
      blocks.push({ kind: "code", text: code.join("\n") });
    } else if (line.trim() === "") {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

const INLINE_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;

type AdfText = { type: "text"; text: string; marks?: Array<Record<string, unknown>> };

function adfInline(line: string): AdfText[] {
  const nodes: AdfText[] = [];
  let last = 0;
  for (const match of line.matchAll(INLINE_PATTERN)) {
    if (match.index > last) nodes.push({ type: "text", text: line.slice(last, match.index) });
    if (match[1]) {
      nodes.push({
        type: "text",
        text: match[1],
        marks: [{ type: "link", attrs: { href: match[2] } }],
      });
    } else if (match[3]) {
      nodes.push({ type: "text", text: match[3], marks: [{ type: "strong" }] });
    } else {
      nodes.push({ type: "text", text: match[4], marks: [{ type: "code" }] });
    }
    last = match.index + match[0].length;
  }
  if (last < line.length) nodes.push({ type: "text", text: line.slice(last) });
  return nodes;
}

/** Atlassian Document Format, required by Jira Cloud's REST v3. */
export function markdownToAdf(markdown: string) {
  return {
    type: "doc",
    version: 1,
    content: markdownBlocks(markdown).map((block) =>
      block.kind === "code"
        ? { type: "codeBlock", content: block.text ? [{ type: "text", text: block.text }] : [] }
        : {
            type: "paragraph",
            content: block.lines.flatMap((line, index) => [
              ...(index > 0 ? [{ type: "hardBreak" }] : []),
              ...adfInline(line),
            ]),
          },
    ),
  };
}

/** Jira wiki markup, used by Jira Data Center's REST v2. */
export function markdownToJiraWiki(markdown: string): string {
  return markdownBlocks(markdown)
    .map((block) =>
      block.kind === "code"
        ? `{noformat}\n${block.text}\n{noformat}`
        : block.lines
            .map((line) =>
              line.replace(INLINE_PATTERN, (_all, label, href, strong, code) =>
                label ? `[${label}|${href}]` : strong ? `*${strong}*` : `{{${code}}}`,
              ),
            )
            .join("\n"),
    )
    .join("\n\n");
}
