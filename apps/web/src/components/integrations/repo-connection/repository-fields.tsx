import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import type { RepoConnectionState } from "./use-repo-connection";

function repositoryPickerHint(state: RepoConnectionState) {
  if (state.githubRepositoriesStatus === "loading") {
    return "Loading repositories exposed by the installed GitHub App.";
  }
  if (state.githubRepositoriesStatus === "error") {
    return "Could not load repositories from the GitHub App installation.";
  }
  return state.githubRepositories.length > 0
    ? "Repositories exposed by the installed GitHub App."
    : "No repositories are currently exposed by this installation.";
}

function tokenHint(state: RepoConnectionState) {
  if (state.providerChanged) return "Enter a token for the new provider.";
  if (state.connection) return "Leave empty to keep the stored token.";
  if (state.provider === "gitlab") return "Needs api + write_repository scopes.";
  return state.githubMode === "enterprise"
    ? "Personal access token for this GitHub Enterprise instance."
    : "Personal access token for now. GitHub App install flow comes next.";
}

function tokenPlaceholder(state: RepoConnectionState) {
  if (state.providerChanged) return "Personal access token required";
  if (state.connection) return "(unchanged)";
  return state.provider === "gitlab" ? "Personal access token" : "GitHub token";
}

/** Repository picker (GitHub App) or free-form identifier, token and default branch. */
function RepositoryFields({ state, disabled }: { state: RepoConnectionState; disabled: boolean }) {
  const { connection, githubAppReady, provider } = state;

  return (
    <>
      {provider === "github" && githubAppReady ? (
        <Field hint={repositoryPickerHint(state)} label="Repository">
          <div className="grid gap-2">
            <Select
              disabled={disabled || state.githubRepositories.length === 0}
              name="repoIdentifier"
              onChange={(event) => state.setSelectedGithubRepo(event.target.value)}
              value={state.selectedGithubRepo}
            >
              <option value="" disabled>
                Select a repository
              </option>
              {state.githubRepositories.map((repo) => (
                <option key={repo.id} value={repo.fullName}>
                  {repo.fullName}
                </option>
              ))}
            </Select>
            <div className="flex justify-end">
              <Button
                disabled={disabled || state.isSyncingRepositories}
                onClick={state.syncRepositories}
                size="sm"
                type="button"
                variant="ghost"
              >
                {state.isSyncingRepositories ? "Refreshing…" : "Refresh repositories"}
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
            disabled={disabled}
            name="repoIdentifier"
            placeholder={provider === "gitlab" ? "group/project" : "owner/repo"}
            required
          />
        </Field>
      )}
      {!githubAppReady ? (
        <Field hint={tokenHint(state)} label="Access token">
          <Input
            autoComplete="off"
            disabled={disabled}
            name="token"
            placeholder={tokenPlaceholder(state)}
            required={!connection || state.providerChanged || state.githubModeChanged}
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
            disabled={disabled}
            name="defaultBranch"
            onChange={(event) => state.setSelectedDefaultBranch(event.target.value)}
            placeholder="main"
            value={state.selectedDefaultBranch}
          />
        ) : (
          <Input
            defaultValue={connection?.defaultBranch ?? ""}
            disabled={disabled}
            name="defaultBranch"
            placeholder="main"
          />
        )}
      </Field>
    </>
  );
}

export { RepositoryFields };
