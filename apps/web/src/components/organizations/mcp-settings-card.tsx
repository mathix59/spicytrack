import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Plus,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

import type { ProjectDto } from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { orvalFetch } from "@/lib/orval-fetch";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { formatLocalDateTime, getErrorMessage } from "@/lib/utils";

const SCOPES = [
  ["projects:read", "Projects"],
  ["issues:read", "Issues"],
  ["events:read", "Events (redacted)"],
  ["releases:read", "Releases"],
  ["autofix:read", "Autofix runs"],
  ["issues:write", "Update issues"],
  ["comments:write", "Create comments"],
  ["autofix:run", "Run Autofix"],
] as const;

type Credential = {
  id: string;
  name: string;
  tokenPreview: string;
  scopes: string[];
  allProjects: boolean;
  projectIds: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};
type McpActivity = {
  id: string;
  action: string;
  payload: { tool?: string; status?: string };
  createdAt: string;
  credentialName: string | null;
};
type McpData = {
  endpoint: string;
  enabled: boolean;
  credentials: Credential[];
  activity: McpActivity[];
};
type McpKeyResponse = { credential: Credential; secret: string };
type McpVerification = {
  ready: boolean;
  checks: { serverEnabled: boolean; credentialActive: boolean; projectsAccessible: number };
};

async function request<T>(
  orgSlug: string,
  path: string,
  options: { method: string; body?: Record<string, unknown> | BodyInit | null },
) {
  return orvalFetch<{ data: T }>(`/organizations/${orgSlug}/mcp${path}`, options as never).then(
    (response) => response.data,
  );
}

function McpSettingsCard({
  orgSlug,
  projects,
  canManage,
}: {
  orgSlug: string;
  projects: ProjectDto[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verification, setVerification] = useState<McpVerification | null>(null);
  const key = ["organization-mcp", orgSlug];
  const query = useQuery({
    queryKey: key,
    queryFn: () => request<McpData>(orgSlug, "", { method: "GET" }),
    enabled: canManage,
    retry: false,
  });
  const data = query.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const settings = useMutation({
    mutationFn: (enabled: boolean) =>
      request<McpData>(orgSlug, "/settings", { method: "PATCH", body: { enabled } }),
    onSuccess: refresh,
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      request<McpKeyResponse>(orgSlug, "/credentials", { method: "POST", body }),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (credentialId: string) =>
      request<{ success: boolean }>(orgSlug, `/credentials/${credentialId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const rotate = useMutation({
    mutationFn: (credentialId: string) =>
      request<McpKeyResponse>(orgSlug, `/credentials/${credentialId}/rotate`, { method: "POST" }),
    onSuccess: refresh,
  });
  const verify = useMutation({
    mutationFn: (credentialId: string) =>
      request<McpVerification>(orgSlug, `/credentials/${credentialId}/verify`, { method: "POST" }),
  });
  const endpoint = `${resolveApiBaseUrl()}/mcp`;
  const clientConfig = `{"mcpServers":{"SpicyTrack":{"url":"${endpoint}","headers":{"Authorization":"Bearer ${secret ?? "stp_mcp_…"}"}}}}`;

  const createCredential = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const scopes = SCOPES.filter(([scope]) => form.get(scope) === "on").map(([scope]) => scope);
    const allProjects = form.get("allProjects") === "on";
    const projectIds = projects
      .filter((project) => form.get(`project:${project.id}`) === "on")
      .map((project) => project.id);
    try {
      const result = await create.mutateAsync({
        name: String(form.get("name") ?? ""),
        scopes,
        allProjects,
        projectIds,
        expiresInDays: Number(form.get("expiresInDays") || 0) || undefined,
      });
      setSecret(result.secret);
      setVerification(null);
      setOpen(false);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  };

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

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>MCP & automation</CardTitle>
          <p className="text-sm text-muted-foreground">
            Give approved AI clients project-scoped access to SpicyTrack, with explicit write
            scopes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {data?.enabled ? "Enabled" : "Disabled"}
          </span>
          <Switch
            aria-label="Enable MCP and automation"
            checked={data?.enabled ?? false}
            disabled={settings.isPending || query.isLoading}
            onCheckedChange={(enabled) => settings.mutate(enabled)}
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {query.isError ? (
          <Alert variant="destructive">
            <AlertDescription>Could not load MCP settings.</AlertDescription>
          </Alert>
        ) : null}
        {secret ? (
          <Alert>
            <AlertDescription className="grid gap-2">
              <span>Copy this key now. It will not be shown again.</span>
              <code className="break-all rounded bg-muted px-2 py-1.5 text-xs">{secret}</code>
              <Button
                className="w-fit"
                onClick={() => navigator.clipboard.writeText(secret)}
                size="sm"
                type="button"
                variant="outline"
              >
                <Copy className="size-3.5" />
                Copy key
              </Button>
              <code className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted px-2 py-1.5 text-xs">{`{"mcpServers":{"SpicyTrack":{"url":"${endpoint}","headers":{"Authorization":"Bearer ${secret}"}}}}`}</code>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="grid gap-0.5">
            <span className="text-sm font-medium">Server endpoint</span>
            <code className="text-xs text-muted-foreground">{endpoint}</code>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setOnboardingOpen(true)} size="sm" variant="outline">
              <Sparkles className="size-4" />
              Set up a client
            </Button>
            <Button disabled={!data?.enabled} onClick={() => setOpen(true)} size="sm">
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
          <code className="max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted px-2 py-1.5 text-xs">{`{"mcpServers":{"SpicyTrack":{"url":"${endpoint}","headers":{"Authorization":"Bearer stp_mcp_…"}}}}`}</code>
        </div>
        <div className="grid gap-2">
          {data?.credentials.length ? (
            data.credentials.map((credential) => (
              <div
                className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                key={credential.id}
              >
                <div className="min-w-0 grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{credential.name}</span>
                    {credential.revokedAt ? (
                      <Badge variant="muted">Revoked</Badge>
                    ) : (
                      <Badge variant="accent">Active</Badge>
                    )}
                    <code className="text-xs text-muted-foreground">
                      {credential.tokenPreview}…
                    </code>
                    <p className="text-xs text-muted-foreground">
                      Read-only keys are the default. Every write tool requires a separate explicit
                      confirmation.
                    </p>
                  </div>
                  {verification ? (
                    <Alert variant={verification.ready ? "default" : "destructive"}>
                      <AlertDescription className="flex items-center gap-2">
                        <CheckCircle2 className="size-4" />
                        {verification.ready
                          ? `Ready: server enabled, active key, ${verification.checks.projectsAccessible} accessible project${verification.checks.projectsAccessible === 1 ? "" : "s"}.`
                          : "This key is not ready. Enable MCP or replace the expired/revoked key."}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    {credential.allProjects
                      ? "All projects"
                      : `${credential.projectIds.length} selected project${credential.projectIds.length === 1 ? "" : "s"}`}{" "}
                    · {credential.scopes.join(", ")} ·{" "}
                    {credential.lastUsedAt
                      ? `Used ${formatLocalDateTime(credential.lastUsedAt)}`
                      : "Never used"}
                    {credential.expiresAt
                      ? ` · Expires ${formatLocalDateTime(credential.expiresAt)}`
                      : ""}
                  </p>
                </div>
                {!credential.revokedAt ? (
                  <div className="flex gap-1">
                    <Button
                      disabled={verify.isPending}
                      onClick={async () => setVerification(await verify.mutateAsync(credential.id))}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <ShieldCheck className="size-4" />
                      Check
                    </Button>
                    <Button
                      disabled={rotate.isPending}
                      onClick={async () => {
                        const result = await rotate.mutateAsync(credential.id);
                        setSecret(result.secret);
                        setVerification(null);
                      }}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <RotateCw className="size-4" />
                      Rotate
                    </Button>
                    <Button
                      disabled={revoke.isPending}
                      onClick={() => revoke.mutate(credential.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                      Revoke
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No MCP keys yet. Create one for Claude, Cursor, or your internal automation.
            </p>
          )}
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Recent MCP activity</span>
          {data?.activity.length ? (
            data.activity.slice(0, 8).map((entry) => (
              <p className="text-xs text-muted-foreground" key={entry.id}>
                {entry.credentialName ?? "MCP key"} · {entry.payload?.tool ?? entry.action} ·{" "}
                {entry.payload?.status ?? "recorded"} · {formatLocalDateTime(entry.createdAt)}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No MCP activity yet.</p>
          )}
        </div>
      </CardContent>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create MCP key</DialogTitle>
            <DialogDescription>
              This key can only read the scopes and projects selected below.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={createCredential}>
            <Field label="Name">
              <Input name="name" placeholder="Production triage" required />
            </Field>
            <Field hint="Leave empty for a key without expiry." label="Expires in days">
              <Input min="1" max="365" name="expiresInDays" type="number" />
            </Field>
            <Field label="Access">
              <div className="grid gap-2">
                {SCOPES.map(([scope, label], index) => (
                  <label className="flex items-center gap-2 text-sm" key={scope}>
                    <input defaultChecked={index < 4} name={scope} type="checkbox" />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Projects">
              <label className="flex items-center gap-2 text-sm">
                <input defaultChecked name="allProjects" type="checkbox" />
                All current and future projects
              </label>
              <div className="grid max-h-32 gap-1 overflow-y-auto pl-5">
                {projects.map((project) => (
                  <label
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    key={project.id}
                  >
                    <input name={`project:${project.id}`} type="checkbox" />
                    {project.name}
                  </label>
                ))}
              </div>
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button disabled={create.isPending} type="submit">
                <KeyRound className="size-4" />
                {create.isPending ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setOnboardingOpen} open={onboardingOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Connect an AI client</DialogTitle>
            <DialogDescription>
              Give Claude Desktop, Cursor, or Codex scoped access to your SpicyTrack data in a few
              minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="flex gap-3 rounded-md border border-border p-3">
              <Badge
                className="h-6 shrink-0 rounded-full px-2"
                variant={data?.enabled ? "accent" : "muted"}
              >
                1
              </Badge>
              <div className="grid gap-1">
                <span className="text-sm font-medium">Enable your organization server</span>
                <p className="text-xs text-muted-foreground">
                  This enables the single MCP endpoint for keys created in this organization.
                </p>
                {!data?.enabled ? (
                  <Button
                    className="mt-1 w-fit"
                    disabled={settings.isPending}
                    onClick={() => settings.mutate(true)}
                    size="sm"
                    type="button"
                  >
                    Enable MCP
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> Enabled
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3 rounded-md border border-border p-3">
              <Badge
                className="h-6 shrink-0 rounded-full px-2"
                variant={secret ? "accent" : "muted"}
              >
                2
              </Badge>
              <div className="grid gap-1">
                <span className="text-sm font-medium">Create a scoped key</span>
                <p className="text-xs text-muted-foreground">
                  Start read-only and select only the projects this client should see.
                </p>
                {!secret ? (
                  <Button
                    className="mt-1 w-fit"
                    disabled={!data?.enabled}
                    onClick={() => {
                      setOnboardingOpen(false);
                      setOpen(true);
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <KeyRound className="size-3.5" /> Create a key
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="size-3.5" /> Key copied into this setup
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-3 rounded-md border border-border p-3">
              <Badge
                className="h-6 shrink-0 rounded-full px-2"
                variant={secret ? "accent" : "muted"}
              >
                3
              </Badge>
              <div className="min-w-0 grid gap-2">
                <span className="text-sm font-medium">Paste the connection into your client</span>
                <p className="text-xs text-muted-foreground">
                  Add this streamable HTTP server in your client’s MCP settings.
                </p>
                <code className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-muted px-2 py-1.5 text-xs">
                  {clientConfig}
                </code>
                <Button
                  className="w-fit"
                  disabled={!secret}
                  onClick={() => navigator.clipboard.writeText(clientConfig)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Copy className="size-3.5" /> Copy configuration
                </Button>
              </div>
            </div>
            <div className="flex gap-3 rounded-md border border-border p-3">
              <Badge className="h-6 shrink-0 rounded-full px-2" variant="muted">
                4
              </Badge>
              <div className="grid gap-1">
                <span className="text-sm font-medium">Verify the first connection</span>
                <p className="text-xs text-muted-foreground">
                  In the client, ask “List my SpicyTrack projects”, then use Check on the key below
                  to confirm its access.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOnboardingOpen(false)} type="button">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export { McpSettingsCard };
