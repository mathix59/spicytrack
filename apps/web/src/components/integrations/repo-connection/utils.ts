import {
  type RepoConnectionDtoProvider,
  type TestRepoConnectionBodyDto,
  type UpsertRepoConnectionBodyDto,
  UpsertRepoConnectionBodyDtoProvider,
} from "@/generated/api";
import { HttpError } from "@/lib/orval-fetch";

type GitHubMode = "cloud" | "enterprise";

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

function asGitHubMode(connection: { htmlUrl?: unknown; apiUrl?: unknown }): GitHubMode {
  return asOptionalString(connection.htmlUrl) || asOptionalString(connection.apiUrl)
    ? "enterprise"
    : "cloud";
}

/** Builds the upsert/test request body from the connection form. */
function readRepoConnectionForm(
  form: HTMLFormElement,
  {
    githubAppReady,
    selectedGithubRepo,
    selectedDefaultBranch,
  }: { githubAppReady: boolean; selectedGithubRepo: string; selectedDefaultBranch: string },
): UpsertRepoConnectionBodyDto & TestRepoConnectionBodyDto {
  const formData = new FormData(form);
  const token = String(formData.get("token") ?? "").trim();
  const nextProvider = asProvider(String(formData.get("provider") ?? "github"));
  const nextGithubMode =
    String(formData.get("githubMode") ?? "cloud") === "enterprise" ? "enterprise" : "cloud";
  const enterprise = nextProvider === "github" && nextGithubMode === "enterprise";
  const usesGithubApp = nextProvider === "github" && githubAppReady;
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
    htmlUrl: (enterprise ? htmlUrl || null : null) as never,
    apiUrl: (enterprise ? apiUrl || null : null) as never,
    gitUser: (enterprise ? gitUser || null : null) as never,
    gitPort: (enterprise ? (gitPortValue ? Number(gitPortValue) : null) : null) as never,
    repoIdentifier: usesGithubApp
      ? selectedGithubRepo
      : String(formData.get("repoIdentifier") ?? "").trim(),
    defaultBranch: usesGithubApp
      ? selectedDefaultBranch || undefined
      : String(formData.get("defaultBranch") ?? "").trim() || undefined,
    ...(token ? { token } : {}),
  };
}

export { asGitHubMode, asOptionalString, asProvider, errorMessage, readRepoConnectionForm };
export type { GitHubMode };
