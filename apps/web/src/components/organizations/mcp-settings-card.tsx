import { Plus, Sparkles } from "lucide-react";

import type { ProjectDto } from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatLocalDateTime } from "@/lib/utils";

import { buildClientConfig } from "./mcp-settings/mcp-api";
import { CreateMcpKeyDialog } from "./mcp-settings/create-mcp-key-dialog";
import { McpCredentialRow } from "./mcp-settings/mcp-credential-row";
import { McpOnboardingDialog } from "./mcp-settings/mcp-onboarding-dialog";
import { useMcpSettings, type McpSettingsState } from "./mcp-settings/use-mcp-settings";

function McpSettingsCard({
  orgSlug,
  projects,
  canManage,
}: {
  orgSlug: string;
  projects: ProjectDto[];
  canManage: boolean;
}) {
  const state = useMcpSettings({ orgSlug, projects, canManage });

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MCP & automation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You need the MCP management permission to configure automation access.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { data, query } = state;

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>MCP & automation</CardTitle>
          <CardDescription>
            Give approved AI clients project-scoped access to SpicyTrack, with explicit write
            scopes. Read-only keys are the default; every write tool requires an explicit scope.
          </CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {data?.enabled ? "Enabled" : "Disabled"}
          </span>
          <Switch
            aria-label="Enable MCP and automation"
            checked={data?.enabled ?? false}
            disabled={state.isTogglingServer || query.isPending || query.isError}
            onCheckedChange={state.setEnabled}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {query.isError ? (
          <QueryError
            error={query.error}
            onRetry={() => void query.refetch()}
            title="Could not load MCP settings"
          />
        ) : null}
        {state.secret ? <NewSecretAlert endpoint={state.endpoint} secret={state.secret} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="grid min-w-0 gap-0.5">
            <span className="text-sm font-medium">Server endpoint</span>
            <span className="flex min-w-0 items-center gap-1">
              <code className="truncate text-xs text-muted-foreground">{state.endpoint}</code>
              <CopyButton
                label="Copy endpoint"
                successMessage="Endpoint copied"
                value={state.endpoint}
              />
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => state.setOnboardingOpen(true)} size="sm" variant="outline">
              <Sparkles className="size-4" />
              Set up a client
            </Button>
            <Button disabled={!data?.enabled} onClick={() => state.setCreateOpen(true)} size="sm">
              <Plus className="size-4" />
              Create MCP key
            </Button>
          </div>
        </div>
        <div className="grid gap-2 rounded-md border border-border p-3">
          <span className="text-sm font-medium">Connect a client</span>
          <p className="text-xs text-muted-foreground">
            Create a scoped key, paste this into Claude Desktop, Cursor, or Codex, then ask it to
            list your projects.
          </p>
          <code className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 text-xs">
            {buildClientConfig(state.endpoint, null)}
          </code>
        </div>
        <McpCredentialList state={state} />
        <McpActivityList state={state} />
      </CardContent>

      <CreateMcpKeyDialog
        error={state.createError}
        isPending={state.isCreating}
        onOpenChange={state.setCreateOpen}
        onSubmit={(event) => void state.createCredential(event)}
        open={state.createOpen}
        projects={projects}
      />
      <McpOnboardingDialog state={state} />
    </Card>
  );
}

function NewSecretAlert({ secret, endpoint }: { secret: string; endpoint: string }) {
  return (
    <Alert variant="warning">
      <AlertTitle>Copy this key now. It will not be shown again.</AlertTitle>
      <AlertDescription className="grid gap-2 text-foreground">
        <span className="flex min-w-0 items-center gap-1">
          <code className="min-w-0 break-all rounded bg-muted px-2 py-1.5 text-xs">{secret}</code>
          <CopyButton label="Copy key" successMessage="Key copied" value={secret} />
        </span>
        <span className="flex min-w-0 items-start gap-1">
          <code className="max-h-24 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 text-xs">
            {buildClientConfig(endpoint, secret)}
          </code>
          <CopyButton
            label="Copy configuration"
            successMessage="Configuration copied"
            value={buildClientConfig(endpoint, secret)}
          />
        </span>
      </AlertDescription>
    </Alert>
  );
}

function McpCredentialList({ state }: { state: McpSettingsState }) {
  if (state.query.isPending) return <SkeletonRows rows={2} />;
  if (state.query.isError) return null;

  const credentials = state.data?.credentials ?? [];
  if (credentials.length === 0) {
    return (
      <EmptyState
        description="Create one for Claude, Cursor, or your internal automation."
        title="No MCP keys yet"
      />
    );
  }

  return (
    <div className="grid gap-2">
      {credentials.map((credential) => (
        <McpCredentialRow
          credential={credential}
          isVerifying={state.isVerifying}
          key={credential.id}
          onRevoke={() => state.revokeCredential(credential.id)}
          onRotate={() => state.rotateCredential(credential.id)}
          onVerify={() => void state.verifyCredential(credential.id)}
          verification={
            state.verification?.credentialId === credential.id ? state.verification.result : null
          }
        />
      ))}
    </div>
  );
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `projectId=1d896420…, query=timeout`: what the agent asked, readable in one line. */
function formatToolArguments(args: Record<string, unknown> | undefined) {
  if (!args) return "";
  return Object.entries(args)
    .filter(([key]) => key !== "confirmed")
    .map(([key, value]) => {
      const text = typeof value === "string" ? value : JSON.stringify(value);
      return `${key}=${UUID_PATTERN.test(text) ? `${text.slice(0, 8)}…` : text}`;
    })
    .join(", ");
}

function McpActivityList({ state }: { state: McpSettingsState }) {
  const activity = state.data?.activity ?? [];

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Recent MCP activity</span>
      {state.query.isPending ? (
        <Skeleton className="h-4 w-2/3" />
      ) : activity.length ? (
        activity.slice(0, 8).map((entry) => {
          const args = formatToolArguments(entry.payload?.arguments);
          return (
            <div className="grid min-w-0 text-xs text-muted-foreground" key={entry.id}>
              <p>
                {entry.credentialName ?? "MCP key"} · {entry.payload?.tool ?? entry.action} ·{" "}
                {entry.payload?.status ?? "recorded"} · {formatLocalDateTime(entry.createdAt)}
              </p>
              {args ? (
                <p className="truncate font-mono" title={args}>
                  {args}
                </p>
              ) : null}
              {entry.payload?.error ? (
                <p className="truncate text-destructive" title={entry.payload.error}>
                  {entry.payload.error}
                </p>
              ) : null}
            </div>
          );
        })
      ) : (
        <p className="text-sm text-muted-foreground">No MCP activity yet.</p>
      )}
    </div>
  );
}

export { McpSettingsCard };
