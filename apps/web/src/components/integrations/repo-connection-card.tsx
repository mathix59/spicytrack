import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  type RepoConnectionDtoProvider,
  type TestRepoConnectionBodyDto,
  type UpsertRepoConnectionBodyDto,
  TestRepoConnectionBodyDtoProvider,
  UpsertRepoConnectionBodyDtoProvider,
  getGetRepoConnectionQueryKey,
  getListOrganizationGithubRepositoriesQueryKey,
  useGetOrganizationGithubAppSettings,
  useListOrganizationGithubRepositories,
  useDeleteRepoConnection,
  useGetRepoConnection,
  useSyncOrganizationGithubRepositories,
  useTestRepoConnection,
  useUpsertRepoConnection,
} from "@/generated/api";
import { HttpError } from "@/lib/orval-fetch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

function errorMessage(error: unknown): string {
  if (error instanceof HttpError) {
    try {
      const parsed = JSON.parse(error.message) as { message?: string };
      return parsed.message ?? error.message;
    } catch {
      return error.message;
    }
  }

  return error instanceof Error ? error.message : "Something went wrong";
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asProvider(value: string): RepoConnectionDtoProvider {
  return value === "gitlab" ? "gitlab" : "github";
}

function asGitHubMode(connection: { htmlUrl?: unknown; apiUrl?: unknown }): "cloud" | "enterprise" {
  return asOptionalString(connection.htmlUrl) || asOptionalString(connection.apiUrl)
    ? "enterprise"
    : "cloud";
}

function RepoConnectionCard({
  orgSlug,
  projectSlug,
  canManage,
}: {
  orgSlug: string;
  projectSlug: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [provider, setProvider] = useState<RepoConnectionDtoProvider>("github");
  const [githubMode, setGithubMode] = useState<"cloud" | "enterprise">("cloud");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [selectedGithubRepo, setSelectedGithubRepo] = useState("");
  const [selectedDefaultBranch, setSelectedDefaultBranch] = useState("");

  const connectionQuery = useGetRepoConnection(orgSlug, projectSlug, {
    query: { retry: false },
  });
  const githubAppSettingsQuery = useGetOrganizationGithubAppSettings(orgSlug, {
    query: { enabled: canManage, retry: false },
  });
  const connection =
    connectionQuery.error instanceof HttpError && connectionQuery.error.status === 404
      ? null
      : connectionQuery.data?.data;
  const githubAppSettings = githubAppSettingsQuery.data?.data;
  const githubAppReady =
    provider === "github" && Boolean(githubAppSettings?.installationId && githubAppSettings?.appId);
  const githubRepositoriesQuery = useListOrganizationGithubRepositories(orgSlug, {
    query: {
      enabled: canManage && githubAppReady,
      retry: false,
    },
  });
  const githubRepositories = githubRepositoriesQuery.data?.data ?? [];
  const selectedGithubRepository = githubRepositories.find(
    (repo) => repo.fullName === selectedGithubRepo,
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetRepoConnectionQueryKey(orgSlug, projectSlug),
      }),
      queryClient.invalidateQueries({
        queryKey: getListOrganizationGithubRepositoriesQueryKey(orgSlug),
      }),
    ]);
  };

  const upsertMutation = useUpsertRepoConnection({
    mutation: { onSuccess: invalidate },
  });
  const deleteMutation = useDeleteRepoConnection({
    mutation: { onSuccess: invalidate },
  });
  const syncRepositoriesMutation = useSyncOrganizationGithubRepositories({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getListOrganizationGithubRepositoriesQueryKey(orgSlug),
        });
      },
    },
  });
  const testMutation = useTestRepoConnection();
  const providerChanged = Boolean(connection && provider !== connection.provider);
  const githubModeChanged =
    provider === "github" &&
    connection?.provider === "github" &&
    githubMode !== asGitHubMode(connection);

  useEffect(() => {
    if (connection?.provider) {
      setProvider(connection.provider);
    }
  }, [connection?.provider]);

  useEffect(() => {
    if (connection?.provider === "github") {
      setGithubMode(asGitHubMode(connection));
    }
  }, [connection]);

  useEffect(() => {
    if (provider !== "github" || !githubAppReady) {
      return;
    }

    const repoIdentifier = connection?.repoIdentifier ?? "";
    setSelectedGithubRepo(repoIdentifier);
  }, [connection?.repoIdentifier, githubAppReady, provider]);

  useEffect(() => {
    if (provider !== "github" || !githubAppReady) {
      return;
    }

    if (selectedGithubRepository?.defaultBranch) {
      setSelectedDefaultBranch(selectedGithubRepository.defaultBranch);
      return;
    }

    setSelectedDefaultBranch(connection?.defaultBranch ?? "");
  }, [connection?.defaultBranch, githubAppReady, provider, selectedGithubRepository]);

  const readForm = (
    form: HTMLFormElement,
  ): UpsertRepoConnectionBodyDto & TestRepoConnectionBodyDto => {
    const formData = new FormData(form);
    const token = String(formData.get("token") ?? "").trim();
    const nextProvider = asProvider(String(formData.get("provider") ?? "github"));
    const nextGithubMode =
      String(formData.get("githubMode") ?? "cloud") === "enterprise" ? "enterprise" : "cloud";
    const htmlUrl = String(formData.get("htmlUrl") ?? "").trim();
    const apiUrl = String(formData.get("apiUrl") ?? "").trim();
    const gitUser = String(formData.get("gitUser") ?? "").trim();
    const gitPortValue = String(formData.get("gitPort") ?? "").trim();

    return {
      provider:
        nextProvider === "gitlab"
          ? UpsertRepoConnectionBodyDtoProvider.gitlab
          : UpsertRepoConnectionBodyDtoProvider.github,
      baseUrl: (String(formData.get("baseUrl") ?? "").trim() || null) as never,
      htmlUrl: (nextProvider === "github" && nextGithubMode === "enterprise"
        ? htmlUrl || null
        : null) as never,
      apiUrl: (nextProvider === "github" && nextGithubMode === "enterprise"
        ? apiUrl || null
        : null) as never,
      gitUser: (nextProvider === "github" && nextGithubMode === "enterprise"
        ? gitUser || null
        : null) as never,
      gitPort: (nextProvider === "github" && nextGithubMode === "enterprise"
        ? gitPortValue
          ? Number(gitPortValue)
          : null
        : null) as never,
      repoIdentifier:
        nextProvider === "github" && githubAppReady
          ? selectedGithubRepo
          : String(formData.get("repoIdentifier") ?? "").trim(),
      defaultBranch:
        nextProvider === "github" && githubAppReady
          ? selectedDefaultBranch || undefined
          : String(formData.get("defaultBranch") ?? "").trim() || undefined,
      ...(token ? { token } : {}),
    };
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setTestResult(null);

    try {
      await upsertMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: readForm(event.currentTarget),
      });
      setTestResult("Repository connected.");
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  };

  const test = async (form: HTMLFormElement | null) => {
    if (!form) {
      return;
    }

    setError(null);
    setTestResult(null);

    try {
      const result = await testMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: {
          ...readForm(form),
          provider:
            provider === "gitlab"
              ? TestRepoConnectionBodyDtoProvider.gitlab
              : TestRepoConnectionBodyDtoProvider.github,
        },
      });

      if (result.data.ok) {
        const defaultBranch = asOptionalString(result.data.defaultBranch);
        setTestResult(`Connection OK - default branch: ${defaultBranch || "unknown"}`);
      } else {
        setError(asOptionalString(result.data.error) || "Connection failed");
      }
    } catch (testError) {
      setError(errorMessage(testError));
    }
  };

  const disconnect = async () => {
    setError(null);

    try {
      await deleteMutation.mutateAsync({ orgSlug, projectSlug });
      setDisconnectOpen(false);
      setTestResult(null);
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Repository</CardTitle>
          {connection ? (
            <Dialog onOpenChange={setDisconnectOpen} open={disconnectOpen}>
              <DialogTrigger asChild>
                <Button disabled={!canManage} size="sm" type="button" variant="ghost">
                  Disconnect
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Disconnect repository</DialogTitle>
                  <DialogDescription>
                    Autofix will stop working for this project until a new repository is connected.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => setDisconnectOpen(false)} type="button" variant="ghost">
                    Cancel
                  </Button>
                  <Button onClick={disconnect} type="button">
                    Disconnect
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {testResult ? (
          <Alert>
            <AlertDescription>{testResult}</AlertDescription>
          </Alert>
        ) : null}

        <form className="grid gap-4" onSubmit={save}>
          <Field label="Provider">
            <Select
              disabled={!canManage}
              name="provider"
              onChange={(event) => {
                const nextProvider = asProvider(event.target.value);
                setProvider(nextProvider);
                if (nextProvider !== "github") {
                  setGithubMode("cloud");
                }
              }}
              value={provider}
            >
              <option value="github">GitHub</option>
              <option value="gitlab">GitLab</option>
            </Select>
          </Field>
          {provider === "github" ? (
            <>
              <Field
                hint="Use GitHub Cloud for github.com, or enter explicit instance URLs for GitHub Enterprise Server."
                label="Hosting"
              >
                <Select
                  disabled={!canManage}
                  name="githubMode"
                  onChange={(event) =>
                    setGithubMode(event.target.value === "enterprise" ? "enterprise" : "cloud")
                  }
                  value={githubMode}
                >
                  <option value="cloud">GitHub Cloud</option>
                  <option value="enterprise">GitHub Enterprise Server</option>
                </Select>
              </Field>

              {githubMode === "enterprise" ? (
                <>
                  <Field label="HTML URL">
                    <Input
                      defaultValue={asOptionalString(connection?.htmlUrl)}
                      disabled={!canManage}
                      name="htmlUrl"
                      placeholder="https://github.example.com"
                      required
                    />
                  </Field>
                  <Field
                    hint="Usually ends with /api/v3 on GitHub Enterprise Server."
                    label="API URL"
                  >
                    <Input
                      defaultValue={asOptionalString(connection?.apiUrl)}
                      disabled={!canManage}
                      name="apiUrl"
                      placeholder="https://github.example.com/api/v3"
                      required
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Custom git user">
                      <Input
                        defaultValue={asOptionalString(connection?.gitUser) || "git"}
                        disabled={!canManage}
                        name="gitUser"
                        placeholder="git"
                      />
                    </Field>
                    <Field label="Custom git port">
                      <Input
                        defaultValue={
                          connection?.gitPort === null || connection?.gitPort === undefined
                            ? "22"
                            : String(connection.gitPort)
                        }
                        disabled={!canManage}
                        min="1"
                        name="gitPort"
                        placeholder="22"
                        type="number"
                      />
                    </Field>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
          {provider === "gitlab" ? (
            <Field
              hint="Leave empty for gitlab.com; set for a self-hosted instance."
              label="Base URL"
            >
              <Input
                defaultValue={asOptionalString(connection?.baseUrl)}
                disabled={!canManage}
                name="baseUrl"
                placeholder="https://gitlab.example.com"
              />
            </Field>
          ) : null}
          {provider === "github" && githubAppReady ? (
            <Field
              hint={
                githubRepositoriesQuery.isPending
                  ? "Loading repositories exposed by the installed GitHub App."
                  : githubRepositoriesQuery.isError
                    ? "Could not load repositories from the GitHub App installation."
                    : githubRepositories.length > 0
                      ? "Repositories exposed by the installed GitHub App."
                      : "No repositories are currently exposed by this installation."
              }
              label="Repository"
            >
              <div className="grid gap-2">
                <Select
                  disabled={!canManage || githubRepositories.length === 0}
                  name="repoIdentifier"
                  onChange={(event) => setSelectedGithubRepo(event.target.value)}
                  value={selectedGithubRepo}
                >
                  <option value="" disabled>
                    Select a repository
                  </option>
                  {githubRepositories.map((repo: { id: number; fullName: string }) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName}
                    </option>
                  ))}
                </Select>
                <div className="flex justify-end">
                  <Button
                    disabled={!canManage || syncRepositoriesMutation.isPending}
                    onClick={() => syncRepositoriesMutation.mutate({ orgSlug })}
                    type="button"
                    variant="ghost"
                  >
                    {syncRepositoriesMutation.isPending ? "Refreshing…" : "Refresh repositories"}
                  </Button>
                </div>
              </div>
            </Field>
          ) : (
            <Field
              hint={
                provider === "gitlab"
                  ? "Full project path, e.g. group/subgroup/project"
                  : "owner/repository"
              }
              label="Repository"
            >
              <Input
                defaultValue={connection?.repoIdentifier ?? ""}
                disabled={!canManage}
                name="repoIdentifier"
                placeholder={provider === "gitlab" ? "group/project" : "owner/repo"}
                required
              />
            </Field>
          )}
          {!githubAppReady ? (
            <Field
              hint={
                providerChanged
                  ? "Enter a token for the new provider."
                  : connection
                    ? "Leave empty to keep the stored token."
                    : provider === "gitlab"
                      ? "Needs api + write_repository scopes."
                      : githubMode === "enterprise"
                        ? "Personal access token for this GitHub Enterprise instance."
                        : "Personal access token for now. GitHub App install flow comes next."
              }
              label="Access token"
            >
              <Input
                autoComplete="off"
                disabled={!canManage}
                name="token"
                placeholder={
                  providerChanged
                    ? "Personal access token required"
                    : connection
                      ? "(unchanged)"
                      : provider === "gitlab"
                        ? "Personal access token"
                        : "GitHub token"
                }
                required={!connection || providerChanged || githubModeChanged}
                type="password"
              />
            </Field>
          ) : null}
          <Field
            hint={
              githubAppReady
                ? "Filled from the selected repository. You can override it before saving."
                : "Branch the autofix PRs target. Empty = repository default."
            }
            label="Default branch"
          >
            {githubAppReady ? (
              <Input
                disabled={!canManage}
                name="defaultBranch"
                onChange={(event) => setSelectedDefaultBranch(event.target.value)}
                placeholder="main"
                value={selectedDefaultBranch}
              />
            ) : (
              <Input
                defaultValue={connection?.defaultBranch ?? ""}
                disabled={!canManage}
                name="defaultBranch"
                placeholder="main"
              />
            )}
          </Field>

          <div className="flex items-center gap-2">
            <Button disabled={!canManage || upsertMutation.isPending} type="submit">
              {upsertMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              disabled={!canManage || testMutation.isPending}
              onClick={(event) => test(event.currentTarget.form)}
              type="button"
              variant="secondary"
            >
              {testMutation.isPending ? "Testing…" : "Test connection"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export { RepoConnectionCard };
