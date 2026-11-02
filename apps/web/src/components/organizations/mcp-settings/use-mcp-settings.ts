import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ProjectDto } from "@/generated/api";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { getErrorMessage } from "@/lib/utils";

import {
  MCP_SCOPES,
  buildClientConfig,
  mcpRequest,
  type McpData,
  type McpKeyResponse,
  type McpVerification,
} from "./mcp-api";

function useMcpSettings({
  orgSlug,
  projects,
  canManage,
}: {
  orgSlug: string;
  projects: ProjectDto[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpenState] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verification, setVerification] = useState<{
    credentialId: string;
    result: McpVerification;
  } | null>(null);
  const key = ["organization-mcp", orgSlug];
  const query = useQuery({
    queryKey: key,
    queryFn: () => mcpRequest<McpData>(orgSlug, "", { method: "GET" }),
    enabled: canManage,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const settings = useMutation({
    mutationFn: (enabled: boolean) =>
      mcpRequest<McpData>(orgSlug, "/settings", { method: "PATCH", body: { enabled } }),
    onSuccess: async (_data, enabled) => {
      await refresh();
      toast.success(enabled ? "MCP enabled" : "MCP disabled");
    },
    onError: (error) => toast.error(`Could not update MCP: ${getErrorMessage(error)}`),
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mcpRequest<McpKeyResponse>(orgSlug, "/credentials", { method: "POST", body }),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (credentialId: string) =>
      mcpRequest<{ success: boolean }>(orgSlug, `/credentials/${credentialId}`, {
        method: "DELETE",
      }),
    onSuccess: refresh,
  });
  const rotate = useMutation({
    mutationFn: (credentialId: string) =>
      mcpRequest<McpKeyResponse>(orgSlug, `/credentials/${credentialId}/rotate`, {
        method: "POST",
      }),
    onSuccess: refresh,
  });
  const verify = useMutation({
    mutationFn: (credentialId: string) =>
      mcpRequest<McpVerification>(orgSlug, `/credentials/${credentialId}/verify`, {
        method: "POST",
      }),
  });
  const endpoint = `${resolveApiBaseUrl()}/mcp`;

  const setCreateOpen = (open: boolean) => {
    if (open) setCreateError(null);
    setCreateOpenState(open);
  };

  const createCredential = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError(null);
    const form = new FormData(event.currentTarget);
    const scopes = MCP_SCOPES.filter(([scope]) => form.get(scope) === "on").map(([scope]) => scope);
    const projectIds = projects
      .filter((project) => form.get(`project:${project.id}`) === "on")
      .map((project) => project.id);
    try {
      const result = await create.mutateAsync({
        name: String(form.get("name") ?? ""),
        scopes,
        allProjects: form.get("allProjects") === "on",
        projectIds,
        expiresInDays: Number(form.get("expiresInDays") || 0) || undefined,
      });
      setSecret(result.secret);
      setVerification(null);
      setCreateOpenState(false);
      toast.success("MCP key created. Copy it now.");
    } catch (submitError) {
      setCreateError(getErrorMessage(submitError));
    }
  };

  const verifyCredential = async (credentialId: string) => {
    try {
      setVerification({ credentialId, result: await verify.mutateAsync(credentialId) });
    } catch (error) {
      toast.error(`Could not check this key: ${getErrorMessage(error)}`);
    }
  };

  /** Rotation and revocation rethrow so their confirmation dialogs can show failures. */
  const rotateCredential = async (credentialId: string) => {
    const result = await rotate.mutateAsync(credentialId);
    setSecret(result.secret);
    setVerification(null);
  };

  const revokeCredential = async (credentialId: string) => {
    await revoke.mutateAsync(credentialId);
    setVerification((current) => (current?.credentialId === credentialId ? null : current));
  };

  return {
    query,
    data: query.data,
    endpoint,
    clientConfig: buildClientConfig(endpoint, secret),
    secret,
    verification,
    createOpen,
    createError,
    onboardingOpen,
    isTogglingServer: settings.isPending,
    isCreating: create.isPending,
    isVerifying: verify.isPending,
    setCreateOpen,
    setOnboardingOpen,
    setEnabled: (enabled: boolean) => settings.mutate(enabled),
    createCredential,
    verifyCredential,
    rotateCredential,
    revokeCredential,
  };
}

type McpSettingsState = ReturnType<typeof useMcpSettings>;

export { useMcpSettings };
export type { McpSettingsState };
