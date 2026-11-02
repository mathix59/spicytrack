import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  type RepoConnectionDtoProvider,
  TestRepoConnectionBodyDtoProvider,
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

import {
  asGitHubMode,
  asOptionalString,
  asProvider,
  errorMessage,
  type GitHubMode,
  readRepoConnectionForm,
} from "./utils";

function useRepoConnection({
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
  const [provider, setProvider] = useState<RepoConnectionDtoProvider>("github");
  const [githubMode, setGithubMode] = useState<GitHubMode>("cloud");
  const [selectedGithubRepo, setSelectedGithubRepo] = useState("");
  const [selectedDefaultBranch, setSelectedDefaultBranch] = useState("");

  const connectionQuery = useGetRepoConnection(orgSlug, projectSlug, {
    query: { retry: false },
  });
  const githubAppSettingsQuery = useGetOrganizationGithubAppSettings(orgSlug, {
    query: { enabled: canManage, retry: false },
  });
  const connectionMissing =
    connectionQuery.error instanceof HttpError && connectionQuery.error.status === 404;
  const connection = connectionMissing ? null : connectionQuery.data?.data;
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

  const readForm = (form: HTMLFormElement) =>
    readRepoConnectionForm(form, { githubAppReady, selectedGithubRepo, selectedDefaultBranch });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await upsertMutation.mutateAsync({
        orgSlug,
        projectSlug,
        data: readForm(event.currentTarget),
      });
      toast.success("Repository connected.");
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  };

  const test = async (form: HTMLFormElement | null) => {
    if (!form) {
      return;
    }

    setError(null);

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
        toast.success(`Connection OK - default branch: ${defaultBranch || "unknown"}`);
      } else {
        setError(asOptionalString(result.data.error) || "Connection failed");
      }
    } catch (testError) {
      setError(errorMessage(testError));
    }
  };

  /** Throws on failure so the confirmation dialog can show the error. */
  const disconnect = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync({ orgSlug, projectSlug });
    } catch (deleteError) {
      throw new Error(errorMessage(deleteError));
    }
  };

  const changeProvider = (value: string) => {
    const nextProvider = asProvider(value);
    setProvider(nextProvider);
    if (nextProvider !== "github") {
      setGithubMode("cloud");
    }
  };

  return {
    connection,
    isLoading: connectionQuery.isLoading,
    loadError: connectionMissing ? null : connectionQuery.error,
    retry: () => void connectionQuery.refetch(),
    error,
    provider,
    githubMode,
    githubAppReady,
    githubRepositories,
    githubRepositoriesStatus: githubRepositoriesQuery.isPending
      ? ("loading" as const)
      : githubRepositoriesQuery.isError
        ? ("error" as const)
        : ("ready" as const),
    selectedGithubRepo,
    selectedDefaultBranch,
    providerChanged,
    githubModeChanged,
    isSaving: upsertMutation.isPending,
    isTesting: testMutation.isPending,
    isSyncingRepositories: syncRepositoriesMutation.isPending,
    changeProvider,
    setGithubMode,
    setSelectedGithubRepo,
    setSelectedDefaultBranch,
    syncRepositories: () => syncRepositoriesMutation.mutate({ orgSlug }),
    save,
    test,
    disconnect,
  };
}

type RepoConnectionState = ReturnType<typeof useRepoConnection>;

export { useRepoConnection };
export type { RepoConnectionState };
