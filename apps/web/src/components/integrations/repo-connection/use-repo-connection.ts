import { useState } from "react";
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
  inputsChanged,
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

  // Form state is seeded from the saved connection and re-seeded when its inputs change.
  // Each block below adjusts state during render when its inputs differ from the ones it last
  // saw (null = never ran, so the first render seeds like a mount effect would).
  const [seenProviderInputs, setSeenProviderInputs] = useState<unknown[] | null>(null);
  const providerInputs = [connection?.provider];
  if (inputsChanged(seenProviderInputs, providerInputs)) {
    setSeenProviderInputs(providerInputs);
    if (connection?.provider) {
      setProvider(connection.provider);
    }
  }

  const [seenGithubModeInputs, setSeenGithubModeInputs] = useState<unknown[] | null>(null);
  const githubModeInputs = [connection];
  if (inputsChanged(seenGithubModeInputs, githubModeInputs)) {
    setSeenGithubModeInputs(githubModeInputs);
    if (connection?.provider === "github") {
      setGithubMode(asGitHubMode(connection));
    }
  }

  const [seenRepoInputs, setSeenRepoInputs] = useState<unknown[] | null>(null);
  const repoInputs = [connection?.repoIdentifier, githubAppReady, provider];
  if (inputsChanged(seenRepoInputs, repoInputs)) {
    setSeenRepoInputs(repoInputs);
    if (provider === "github" && githubAppReady) {
      setSelectedGithubRepo(connection?.repoIdentifier ?? "");
    }
  }

  const [seenBranchInputs, setSeenBranchInputs] = useState<unknown[] | null>(null);
  const branchInputs = [
    connection?.defaultBranch,
    githubAppReady,
    provider,
    selectedGithubRepository,
  ];
  if (inputsChanged(seenBranchInputs, branchInputs)) {
    setSeenBranchInputs(branchInputs);
    if (provider === "github" && githubAppReady) {
      setSelectedDefaultBranch(
        selectedGithubRepository?.defaultBranch || (connection?.defaultBranch ?? ""),
      );
    }
  }

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
