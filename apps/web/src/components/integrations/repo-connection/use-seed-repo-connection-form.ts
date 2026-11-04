import { useState } from "react";

import type {
  GithubAppRepositoryDto,
  RepoConnectionDto,
  RepoConnectionDtoProvider,
} from "@/generated/api";

import { asGitHubMode, type GitHubMode, inputsChanged } from "./utils";

/**
 * Seeds the repo connection form state from the saved connection, and re-seeds it when its
 * inputs change. Runs during render (no effect): the setters belong to the calling hook.
 */
function useSeedRepoConnectionForm({
  connection,
  provider,
  githubAppReady,
  selectedGithubRepository,
  setProvider,
  setGithubMode,
  setSelectedGithubRepo,
  setSelectedDefaultBranch,
}: {
  connection: RepoConnectionDto | null | undefined;
  provider: RepoConnectionDtoProvider;
  githubAppReady: boolean;
  selectedGithubRepository: GithubAppRepositoryDto | undefined;
  setProvider: (provider: RepoConnectionDtoProvider) => void;
  setGithubMode: (mode: GitHubMode) => void;
  setSelectedGithubRepo: (repo: string) => void;
  setSelectedDefaultBranch: (branch: string) => void;
}) {
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
}

export { useSeedRepoConnectionForm };
