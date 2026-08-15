import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, createSign, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { AuditService } from "../audit/audit.service";
import { decryptSecret, encryptSecret } from "../common/secrets";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import {
  organizationGithubAppRepositories,
  organizationGithubAppSettings,
  repoConnections,
} from "../database/schema";
import {
  RepoConnectionInput,
  VcsProviderKind,
  VcsRequestError,
} from "./vcs/vcs-provider.interface";
import { VcsFactory } from "./vcs/vcs.factory";
import { assertAllowedVcsEndpoints, vcsEndpointsChanged } from "./vcs/vcs-url-policy";

export type RepoConnectionRecord = typeof repoConnections.$inferSelect;
type GithubAppSettingsRecord = typeof organizationGithubAppSettings.$inferSelect;
type GithubAppRepositoryRecord = typeof organizationGithubAppRepositories.$inferSelect;

type GithubInstallationSummary = {
  id: number;
  app_slug?: string;
  account?: {
    login?: string;
    type?: string;
  };
  target_type?: string;
};

type GithubInstallationRepositoriesPayload = {
  repositories?: Array<{
    id: number;
    full_name: string;
    default_branch: string;
    private: boolean;
    archived: boolean;
    disabled: boolean;
  }>;
};

type GithubAppManifestState = {
  organizationId: string;
  actorUserId: string;
  expiresAt: number;
};

type GithubAppManifestConversion = {
  id?: number;
  slug?: string;
  client_id?: string;
  client_secret?: string;
  webhook_secret?: string;
  pem?: string;
};

function normalizeRepoIdentifier(value: string) {
  return value.trim().replace(/\.git$/i, "");
}

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "********";
  }

  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function toBase64Url(value: Buffer | string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function publicAppUrl(): string {
  const configured =
    process.env.APP_URL ?? process.env.WEB_BASE_URL ?? process.env.WEB_ORIGIN?.split(",")[0];
  const value = (configured ?? "http://localhost:5173").trim().replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BadRequestException("APP_URL must be an absolute HTTP(S) URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BadRequestException("APP_URL must use HTTP or HTTPS");
  }

  return value;
}

function toDto(connection: RepoConnectionRecord) {
  const githubHtmlUrl =
    connection.provider === "github" ? (connection.htmlUrl ?? connection.baseUrl) : null;
  const githubApiUrl =
    connection.provider === "github" && !connection.apiUrl && githubHtmlUrl
      ? `${githubHtmlUrl.replace(/\/+$/, "")}/api/v3`
      : connection.apiUrl;

  return {
    id: connection.id,
    provider: connection.provider,
    baseUrl: connection.baseUrl,
    htmlUrl: githubHtmlUrl,
    apiUrl: githubApiUrl,
    gitUser: connection.gitUser,
    gitPort: connection.gitPort,
    repoIdentifier: normalizeRepoIdentifier(connection.repoIdentifier),
    defaultBranch: connection.defaultBranch,
    tokenSet: Boolean(connection.tokenCiphertext),
    lastValidatedAt: connection.lastValidatedAt,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

function toStoredConnectionInput(connection: RepoConnectionRecord): RepoConnectionInput {
  const githubHtmlUrl =
    connection.provider === "github" ? (connection.htmlUrl ?? connection.baseUrl) : null;
  const githubApiUrl =
    connection.provider === "github" && !connection.apiUrl && githubHtmlUrl
      ? `${githubHtmlUrl.replace(/\/+$/, "")}/api/v3`
      : connection.apiUrl;

  return {
    baseUrl: connection.baseUrl,
    htmlUrl: githubHtmlUrl,
    apiUrl: githubApiUrl,
    gitUser: connection.gitUser,
    gitPort: connection.gitPort,
    repoIdentifier: normalizeRepoIdentifier(connection.repoIdentifier),
    token: connection.tokenCiphertext ? decryptSecret(connection.tokenCiphertext) : "",
  };
}

function toGithubRepositoryDto(repo: GithubAppRepositoryRecord) {
  return {
    id: repo.githubRepositoryId,
    fullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
    private: repo.private,
    archived: repo.archived,
    disabled: repo.disabled,
  };
}

@Injectable()
export class IntegrationsService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly vcsFactory: VcsFactory,
    private readonly auditService: AuditService,
  ) {}

  async findConnection(projectId: string): Promise<RepoConnectionRecord | null> {
    const [connection] = await this.db
      .select()
      .from(repoConnections)
      .where(eq(repoConnections.projectId, projectId))
      .limit(1);

    return connection ?? null;
  }

  async getConnectionDto(projectId: string) {
    const connection = await this.findConnection(projectId);

    if (!connection) {
      throw new NotFoundException("No repo connection for this project");
    }

    return toDto(connection);
  }

  async getDecryptedConnection(
    projectId: string,
  ): Promise<(RepoConnectionRecord & { input: RepoConnectionInput }) | null> {
    const connection = await this.findConnection(projectId);

    if (!connection) {
      return null;
    }

    return {
      ...connection,
      input: toStoredConnectionInput(connection),
    };
  }

  async testConnection(input: {
    organizationId?: string;
    projectId: string;
    provider?: VcsProviderKind;
    baseUrl?: string | null;
    htmlUrl?: string | null;
    apiUrl?: string | null;
    gitUser?: string | null;
    gitPort?: number | null;
    repoIdentifier?: string;
    token?: string;
  }) {
    let provider: VcsProviderKind;
    let connectionInput: RepoConnectionInput;
    let storedConnection: (RepoConnectionRecord & { input: RepoConnectionInput }) | null = null;

    if (input.provider && input.repoIdentifier && input.token) {
      provider = input.provider;
      connectionInput = {
        baseUrl: input.baseUrl ?? null,
        htmlUrl: input.htmlUrl ?? null,
        apiUrl: input.apiUrl ?? null,
        gitUser: input.gitUser ?? null,
        gitPort: input.gitPort ?? null,
        repoIdentifier: normalizeRepoIdentifier(input.repoIdentifier),
        token: input.token,
      };
    } else {
      const stored = await this.getDecryptedConnection(input.projectId);
      storedConnection = stored;

      if (!stored) {
        if (input.provider === "github" && input.organizationId && input.repoIdentifier) {
          const githubBacked = await this.getGithubAppBackedConnection(input.organizationId, {
            baseUrl: input.baseUrl ?? null,
            htmlUrl: input.htmlUrl ?? null,
            apiUrl: input.apiUrl ?? null,
            gitUser: input.gitUser ?? null,
            gitPort: input.gitPort ?? null,
            repoIdentifier: normalizeRepoIdentifier(input.repoIdentifier),
            token: "",
          });

          if (!githubBacked) {
            throw new BadRequestException("GitHub App installation is required before testing this connection");
          }

          provider = "github";
          connectionInput = githubBacked;
        } else {
          throw new BadRequestException(
            "No stored connection to test; provide provider, repoIdentifier, and token",
          );
        }
      } else {
        if (input.provider && input.provider !== stored.provider && !input.token) {
          return {
            ok: false,
            defaultBranch: null,
            error: "A new token is required when changing provider",
          };
        }

        provider = (input.provider ?? stored.provider) as VcsProviderKind;
        connectionInput = {
          ...stored.input,
          baseUrl: input.baseUrl !== undefined ? input.baseUrl : stored.input.baseUrl,
          htmlUrl: input.htmlUrl !== undefined ? input.htmlUrl : stored.input.htmlUrl,
          apiUrl: input.apiUrl !== undefined ? input.apiUrl : stored.input.apiUrl,
          gitUser: input.gitUser !== undefined ? input.gitUser : stored.input.gitUser,
          gitPort: input.gitPort !== undefined ? input.gitPort : stored.input.gitPort,
          repoIdentifier: normalizeRepoIdentifier(input.repoIdentifier ?? stored.repoIdentifier),
          token: input.token ?? stored.input.token,
        };
      }
    }

    assertAllowedVcsEndpoints(provider, connectionInput);
    if (
      storedConnection?.input.token &&
      !input.token &&
      vcsEndpointsChanged(provider, storedConnection.input, connectionInput)
    ) {
      throw new BadRequestException("A new token is required when changing a VCS endpoint URL");
    }

    if (provider === "github" && !input.token && input.organizationId) {
      const githubBacked = await this.getGithubAppBackedConnection(
        input.organizationId,
        connectionInput,
      );

      if (githubBacked) {
        connectionInput = githubBacked;
      }
    }

    if (!connectionInput.token) {
      return {
        ok: false,
        defaultBranch: null,
        error: "An access token or GitHub App installation is required",
      };
    }

    try {
      const info = await this.vcsFactory.getProvider(provider).validateConnection(connectionInput);
      return { ok: true, defaultBranch: info.defaultBranch, error: null };
    } catch (error) {
      const message =
        error instanceof VcsRequestError
          ? error.message
          : "Connection failed (network error or invalid base URL)";

      return {
        ok: false,
        defaultBranch: null,
        error: connectionInput.token ? message.replaceAll(connectionInput.token, "***") : message,
      };
    }
  }

  async upsertConnection(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
    provider: VcsProviderKind;
    baseUrl: string | null;
    htmlUrl: string | null;
    apiUrl: string | null;
    gitUser: string | null;
    gitPort: number | null;
    repoIdentifier: string;
    token?: string;
    defaultBranch?: string;
  }) {
    const existing = await this.findConnection(input.projectId);
    const repoIdentifier = normalizeRepoIdentifier(input.repoIdentifier);
    const existingToken =
      existing && existing.provider === input.provider && existing.tokenCiphertext
        ? decryptSecret(existing.tokenCiphertext)
        : undefined;

    const connectionInput: RepoConnectionInput = {
      baseUrl: input.baseUrl,
      htmlUrl: input.htmlUrl,
      apiUrl: input.apiUrl,
      gitUser: input.gitUser,
      gitPort: input.gitPort,
      repoIdentifier,
      token: input.token ?? existingToken ?? "",
    };

    assertAllowedVcsEndpoints(input.provider, connectionInput);
    if (
      existingToken &&
      !input.token &&
      existing &&
      vcsEndpointsChanged(
        input.provider,
        {
          baseUrl: existing.baseUrl,
          htmlUrl: existing.htmlUrl,
          apiUrl: existing.apiUrl,
        },
        connectionInput,
      )
    ) {
      throw new BadRequestException("A new token is required when changing a VCS endpoint URL");
    }

    const githubBacked =
      input.provider === "github"
        ? await this.getGithubAppBackedConnection(input.organizationId, connectionInput)
        : null;
    const validationInput = githubBacked ?? connectionInput;

    if (!validationInput.token) {
      throw new BadRequestException("token is required when creating or changing provider");
    }

    let info;
    try {
      info = await this.vcsFactory.getProvider(input.provider).validateConnection(validationInput);
    } catch (error) {
      const message =
        error instanceof VcsRequestError
          ? validationInput.token
            ? error.message.replaceAll(validationInput.token, "***")
            : error.message
          : "Could not reach the repository (check base URL and token)";
      throw new BadRequestException(`Repository validation failed: ${message}`);
    }

    const shouldPersistToken =
      input.provider !== "github" || Boolean(input.token || (!githubBacked && existingToken));

    const values = {
      organizationId: input.organizationId,
      projectId: input.projectId,
      provider: input.provider,
      baseUrl: input.baseUrl,
      htmlUrl: input.htmlUrl,
      apiUrl: input.apiUrl,
      gitUser: input.gitUser,
      gitPort: input.gitPort,
      repoIdentifier,
      tokenCiphertext: shouldPersistToken ? encryptSecret(validationInput.token) : null,
      defaultBranch: input.defaultBranch ?? info.defaultBranch,
      lastValidatedAt: new Date(),
      updatedAt: new Date(),
    };

    const [connection] = existing
      ? await this.db
          .update(repoConnections)
          .set(values)
          .where(eq(repoConnections.id, existing.id))
          .returning()
      : await this.db
          .insert(repoConnections)
          .values({ ...values, createdByUserId: input.actorUserId })
          .returning();

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "integration.repo.connected",
      targetType: "repo_connection",
      targetId: connection.id,
      payload: {
        provider: input.provider,
        repoIdentifier,
        authMode:
          input.provider === "github" && !shouldPersistToken ? "github_app" : "personal_token",
      },
    });

    return toDto(connection);
  }

  async deleteConnection(input: {
    organizationId: string;
    projectId: string;
    actorUserId: string;
  }) {
    const existing = await this.findConnection(input.projectId);

    if (!existing) {
      throw new NotFoundException("No repo connection for this project");
    }

    await this.db.delete(repoConnections).where(eq(repoConnections.id, existing.id));

    await this.auditService.record({
      organizationId: input.organizationId,
      projectId: input.projectId,
      actorUserId: input.actorUserId,
      action: "integration.repo.disconnected",
      targetType: "repo_connection",
      targetId: existing.id,
      payload: {
        provider: existing.provider,
        repoIdentifier: existing.repoIdentifier,
      },
    });

    return { success: true };
  }

  async getOrgGithubAppSettings(organizationId: string) {
    const settings = await this.getRawOrgGithubAppSettings(organizationId);

    return {
      mode: settings?.mode ?? "cloud",
      htmlUrl: settings?.htmlUrl ?? null,
      apiUrl: settings?.apiUrl ?? null,
      gitUser: settings?.gitUser ?? null,
      gitPort: settings?.gitPort ?? null,
      appSlug: settings?.appSlug ?? null,
      appId: settings?.appId ?? null,
      clientId: settings?.clientId ?? null,
      installationId: settings?.installationId ?? null,
      installationAccountLogin: settings?.installationAccountLogin ?? null,
      installationAccountType: settings?.installationAccountType ?? null,
      clientSecretSet: Boolean(settings?.clientSecretCiphertext),
      privateKeySet: Boolean(settings?.privateKeyCiphertext),
      webhookSecretSet: Boolean(settings?.webhookSecretCiphertext),
      maskedClientSecret: settings?.clientSecretCiphertext
        ? maskSecret(decryptSecret(settings.clientSecretCiphertext))
        : null,
      maskedWebhookSecret: settings?.webhookSecretCiphertext
        ? maskSecret(decryptSecret(settings.webhookSecretCiphertext))
        : null,
    };
  }

  async updateOrgGithubAppSettings(input: {
    organizationId: string;
    actorUserId: string;
    mode?: "cloud" | "enterprise";
    htmlUrl?: string | null;
    apiUrl?: string | null;
    gitUser?: string | null;
    gitPort?: number | null;
    appSlug?: string | null;
    appId?: string | null;
    clientId?: string | null;
    installationId?: string | null;
    installationAccountLogin?: string | null;
    installationAccountType?: string | null;
    clientSecret?: string | null;
    privateKey?: string | null;
    webhookSecret?: string | null;
  }) {
    const existing = await this.getRawOrgGithubAppSettings(input.organizationId);
    const nextMode = input.mode ?? existing?.mode ?? "cloud";
    const next = {
      mode: nextMode,
      htmlUrl:
        input.htmlUrl === undefined
          ? (existing?.htmlUrl ?? null)
          : nextMode === "enterprise"
            ? input.htmlUrl
            : null,
      apiUrl:
        input.apiUrl === undefined
          ? (existing?.apiUrl ?? null)
          : nextMode === "enterprise"
            ? input.apiUrl
            : null,
      gitUser:
        input.gitUser === undefined
          ? (existing?.gitUser ?? null)
          : nextMode === "enterprise"
            ? input.gitUser
            : null,
      gitPort:
        input.gitPort === undefined
          ? (existing?.gitPort ?? null)
          : nextMode === "enterprise"
            ? input.gitPort
            : null,
      appSlug: input.appSlug === undefined ? (existing?.appSlug ?? null) : input.appSlug,
      appId: input.appId === undefined ? (existing?.appId ?? null) : input.appId,
      clientId: input.clientId === undefined ? (existing?.clientId ?? null) : input.clientId,
      installationId:
        input.installationId === undefined
          ? (existing?.installationId ?? null)
          : input.installationId,
      installationAccountLogin:
        input.installationAccountLogin === undefined
          ? (existing?.installationAccountLogin ?? null)
          : input.installationAccountLogin,
      installationAccountType:
        input.installationAccountType === undefined
          ? (existing?.installationAccountType ?? null)
          : input.installationAccountType,
      clientSecretCiphertext:
        input.clientSecret === undefined
          ? (existing?.clientSecretCiphertext ?? null)
          : input.clientSecret
            ? encryptSecret(input.clientSecret)
            : null,
      privateKeyCiphertext:
        input.privateKey === undefined
          ? (existing?.privateKeyCiphertext ?? null)
          : input.privateKey
            ? encryptSecret(input.privateKey)
            : null,
      webhookSecretCiphertext:
        input.webhookSecret === undefined
          ? (existing?.webhookSecretCiphertext ?? null)
          : input.webhookSecret
            ? encryptSecret(input.webhookSecret)
            : null,
    };

    await this.db
      .insert(organizationGithubAppSettings)
      .values({
        organizationId: input.organizationId,
        updatedByUserId: input.actorUserId,
        ...next,
      })
      .onConflictDoUpdate({
        target: organizationGithubAppSettings.organizationId,
        set: {
          ...next,
          updatedByUserId: input.actorUserId,
          updatedAt: new Date(),
        },
      });

    await this.auditService.record({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      action: "org.github_app_settings.updated",
      targetType: "organization_github_app_settings",
      payload: {
        mode: next.mode,
        htmlUrl: next.htmlUrl,
        apiUrl: next.apiUrl,
        gitUser: next.gitUser,
        gitPort: next.gitPort,
        appSlug: next.appSlug,
        appId: next.appId,
        clientId: next.clientId,
        installationId: next.installationId,
        installationAccountLogin: next.installationAccountLogin,
        installationAccountType: next.installationAccountType,
        clientSecretSet: Boolean(next.clientSecretCiphertext),
        privateKeySet: Boolean(next.privateKeyCiphertext),
        webhookSecretSet: Boolean(next.webhookSecretCiphertext),
      },
    });

    return this.getOrgGithubAppSettings(input.organizationId);
  }

  async getOrgGithubAppInstallUrl(organizationId: string) {
    const settings = await this.getOrgGithubAppSettings(organizationId);

    if (!settings.appSlug) {
      throw new BadRequestException("App slug is required before generating an install URL");
    }

    const base =
      settings.mode === "enterprise" ? settings.htmlUrl?.replace(/\/+$/, "") : "https://github.com";

    if (!base) {
      throw new BadRequestException("HTML URL is required for GitHub Enterprise Server");
    }

    return {
      url: `${base}/apps/${encodeURIComponent(settings.appSlug)}/installations/new`,
    };
  }

  async createOrgGithubAppManifest(input: {
    organizationId: string;
    organizationSlug: string;
    actorUserId: string;
    githubOrganization?: string;
  }) {
    const appUrl = publicAppUrl();
    const callbackUrl = `${appUrl}/github-app/setup`;
    const state = toBase64Url(
      encryptSecret(
        JSON.stringify({
          organizationId: input.organizationId,
          actorUserId: input.actorUserId,
          expiresAt: Date.now() + 60 * 60 * 1000,
        } satisfies GithubAppManifestState),
      ),
    );
    const githubOrganization = input.githubOrganization?.trim();
    const action = githubOrganization
      ? `https://github.com/organizations/${encodeURIComponent(githubOrganization)}/settings/apps/new`
      : "https://github.com/settings/apps/new";

    return {
      action,
      state,
      manifest: JSON.stringify({
        name: `SpicyTrack ${input.organizationSlug}`.slice(0, 34),
        url: appUrl,
        description: "Private GitHub App used by SpicyTrack Autofix.",
        redirect_url: callbackUrl,
        setup_url: callbackUrl,
        setup_on_update: true,
        public: false,
        hook_attributes: {
          url: `${appUrl}/api/github-app/webhooks`,
          active: true,
        },
        default_permissions: {
          contents: "write",
          metadata: "read",
          pull_requests: "write",
        },
        default_events: ["repository"],
      }),
    };
  }

  async completeOrgGithubAppManifest(input: {
    organizationId: string;
    actorUserId: string;
    code: string;
    state: string;
  }) {
    this.assertGithubAppManifestState(input.state, input.organizationId, input.actorUserId);

    const response = await fetch(
      `https://api.github.com/app-manifests/${encodeURIComponent(input.code)}/conversions`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "SpicyTrack",
        },
      },
    );
    const conversion = (await response.json()) as GithubAppManifestConversion;

    if (
      !response.ok ||
      !conversion.id ||
      !conversion.slug ||
      !conversion.client_id ||
      !conversion.client_secret ||
      !conversion.webhook_secret ||
      !conversion.pem
    ) {
      throw new BadRequestException(
        `GitHub App manifest conversion failed${response.ok ? "" : ` (${response.status})`}`,
      );
    }

    await this.updateOrgGithubAppSettings({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      mode: "cloud",
      appSlug: conversion.slug,
      appId: String(conversion.id),
      clientId: conversion.client_id,
      clientSecret: conversion.client_secret,
      privateKey: conversion.pem,
      webhookSecret: conversion.webhook_secret,
      installationId: null,
      installationAccountLogin: null,
      installationAccountType: null,
    });

    await this.db
      .delete(organizationGithubAppRepositories)
      .where(eq(organizationGithubAppRepositories.organizationId, input.organizationId));

    return {
      installUrl: `https://github.com/apps/${encodeURIComponent(conversion.slug)}/installations/new?state=${encodeURIComponent(input.state)}`,
      settings: await this.getOrgGithubAppSettings(input.organizationId),
    };
  }

  async completeOrgGithubAppInstallation(input: {
    organizationId: string;
    actorUserId: string;
    installationId: string;
    state?: string;
  }) {
    if (input.state) {
      this.assertGithubAppManifestState(input.state, input.organizationId, input.actorUserId);
    }

    const settings = await this.getRawOrgGithubAppSettings(input.organizationId);

    if (!settings) {
      throw new BadRequestException("GitHub App settings must be configured first");
    }

    if (!settings.appId || !settings.privateKeyCiphertext) {
      throw new BadRequestException(
        "App ID and private key are required to validate the installation",
      );
    }

    const installation = await this.fetchGithubInstallationDetails({
      apiUrl: this.getGithubApiUrl(settings),
      appId: settings.appId,
      privateKey: decryptSecret(settings.privateKeyCiphertext),
      installationId: input.installationId,
    });

    await this.updateOrgGithubAppSettings({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      installationId: String(installation.id),
      installationAccountLogin: installation.account?.login ?? null,
      installationAccountType: installation.account?.type ?? installation.target_type ?? null,
      appSlug: installation.app_slug ?? settings.appSlug ?? null,
    });

    await this.syncOrgGithubRepositories(input.organizationId);

    return this.getOrgGithubAppSettings(input.organizationId);
  }

  async listOrgGithubRepositories(organizationId: string) {
    const repositories = await this.readOrgGithubRepositories(organizationId);

    if (repositories.length > 0) {
      return repositories.map(toGithubRepositoryDto);
    }

    return this.syncOrgGithubRepositories(organizationId);
  }

  async syncOrgGithubRepositories(organizationId: string) {
    const context = await this.getGithubAppInstallationContext(organizationId);
    const repositories = await this.fetchGithubInstallationRepositories(
      context.apiUrl,
      context.token,
    );

    await this.db
      .delete(organizationGithubAppRepositories)
      .where(eq(organizationGithubAppRepositories.organizationId, organizationId));

    if (repositories.length > 0) {
      await this.db.insert(organizationGithubAppRepositories).values(
        repositories.map((repo) => ({
          organizationId,
          installationId: context.settings.installationId!,
          githubRepositoryId: repo.id,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          private: repo.private,
          archived: repo.archived,
          disabled: repo.disabled,
        })),
      );
    }

    return this.readOrgGithubRepositories(organizationId).then((rows) =>
      rows.map(toGithubRepositoryDto),
    );
  }

  async handleGithubAppWebhook(input: { event?: string; signature?: string; rawBody: string }) {
    if (!input.event) {
      throw new BadRequestException("Missing X-GitHub-Event header");
    }

    let payload: {
      action?: string;
      installation?: GithubInstallationSummary;
      repositories_removed?: Array<{ id: number }>;
      repository?: {
        id: number;
        full_name: string;
        default_branch?: string;
        private?: boolean;
        archived?: boolean;
        disabled?: boolean;
      };
    };
    try {
      payload = JSON.parse(input.rawBody) as typeof payload;
    } catch {
      throw new BadRequestException("Invalid GitHub webhook payload");
    }

    const installationId = String(payload.installation?.id ?? "");

    if (!installationId) {
      throw new BadRequestException("Missing installation id in webhook payload");
    }

    const organizationSettings = await this.findGithubAppSettingsByInstallationId(installationId);

    if (!organizationSettings) {
      return { success: true };
    }
    if (
      !organizationSettings.webhookSecretCiphertext ||
      !this.verifyGithubWebhookSignature(
        decryptSecret(organizationSettings.webhookSecretCiphertext),
        input.rawBody,
        input.signature,
      )
    ) {
      throw new UnauthorizedException("Invalid GitHub webhook signature");
    }

    if (input.event === "installation") {
      if (payload.action === "deleted") {
        await this.db
          .update(organizationGithubAppSettings)
          .set({
            installationId: null,
            installationAccountLogin: null,
            installationAccountType: null,
            updatedAt: new Date(),
          })
          .where(
            eq(organizationGithubAppSettings.organizationId, organizationSettings.organizationId),
          );

        await this.db
          .delete(organizationGithubAppRepositories)
          .where(
            eq(
              organizationGithubAppRepositories.organizationId,
              organizationSettings.organizationId,
            ),
          );

        return { success: true };
      }

      await this.db
        .update(organizationGithubAppSettings)
        .set({
          installationId,
          installationAccountLogin: payload.installation?.account?.login ?? null,
          installationAccountType:
            payload.installation?.account?.type ?? payload.installation?.target_type ?? null,
          appSlug: payload.installation?.app_slug ?? organizationSettings.appSlug,
          updatedAt: new Date(),
        })
        .where(
          eq(organizationGithubAppSettings.organizationId, organizationSettings.organizationId),
        );

      await this.syncOrgGithubRepositories(organizationSettings.organizationId);
      return { success: true };
    }

    if (
      input.event === "installation_repositories" ||
      input.event === "repository" ||
      input.event === "push" ||
      input.event === "pull_request"
    ) {
      await this.syncOrgGithubRepositories(organizationSettings.organizationId);
      return { success: true };
    }

    return { success: true };
  }

  async getAutofixConnection(
    projectId: string,
    organizationId: string,
  ): Promise<(RepoConnectionRecord & { input: RepoConnectionInput }) | null> {
    const connection = await this.getDecryptedConnection(projectId);

    if (!connection) {
      return null;
    }

    if (connection.provider !== "github") {
      return connection.input.token ? connection : null;
    }

    const githubBacked = await this.getGithubAppBackedConnection(organizationId, connection.input);

    if (githubBacked) {
      return { ...connection, input: githubBacked };
    }

    return connection.input.token ? connection : null;
  }

  private async readOrgGithubRepositories(organizationId: string) {
    return this.db
      .select()
      .from(organizationGithubAppRepositories)
      .where(eq(organizationGithubAppRepositories.organizationId, organizationId));
  }

  private assertGithubAppManifestState(
    state: string,
    organizationId: string,
    actorUserId: string,
  ): void {
    let payload: GithubAppManifestState;
    try {
      payload = JSON.parse(decryptSecret(fromBase64Url(state))) as GithubAppManifestState;
    } catch {
      throw new BadRequestException("Invalid GitHub App manifest state");
    }

    if (
      payload.organizationId !== organizationId ||
      payload.actorUserId !== actorUserId ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt < Date.now()
    ) {
      throw new BadRequestException("Invalid or expired GitHub App manifest state");
    }
  }

  private async getRawOrgGithubAppSettings(organizationId: string) {
    const [settings] = await this.db
      .select()
      .from(organizationGithubAppSettings)
      .where(eq(organizationGithubAppSettings.organizationId, organizationId))
      .limit(1);

    return settings ?? null;
  }

  private async findGithubAppSettingsByInstallationId(installationId: string) {
    const [settings] = await this.db
      .select()
      .from(organizationGithubAppSettings)
      .where(eq(organizationGithubAppSettings.installationId, installationId))
      .limit(1);

    return settings ?? null;
  }

  private buildGithubAppJwt(appId: string, privateKey: string): string {
    const now = Math.floor(Date.now() / 1000);
    const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = toBase64Url(
      JSON.stringify({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: appId,
      }),
    );
    const unsigned = `${header}.${payload}`;
    const signer = createSign("RSA-SHA256");
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(privateKey);
    return `${unsigned}.${toBase64Url(signature)}`;
  }

  private getGithubApiUrl(settings: GithubAppSettingsRecord, fallbackApiUrl?: string | null) {
    const apiUrl =
      settings.apiUrl ??
      fallbackApiUrl ??
      (settings.mode === "enterprise"
        ? settings.htmlUrl
          ? `${settings.htmlUrl.replace(/\/+$/, "")}/api/v3`
          : null
        : "https://api.github.com");

    if (!apiUrl) {
      throw new BadRequestException("API URL is required to reach GitHub App endpoints");
    }

    return apiUrl;
  }

  private async fetchGithubInstallationDetails(input: {
    apiUrl: string;
    appId: string;
    privateKey: string;
    installationId: string;
  }) {
    const jwt = this.buildGithubAppJwt(input.appId, input.privateKey);
    const response = await fetch(
      `${input.apiUrl.replace(/\/+$/, "")}/app/installations/${encodeURIComponent(input.installationId)}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(
        `Failed to validate GitHub App installation (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    return (await response.json()) as GithubInstallationSummary;
  }

  private async createGithubInstallationToken(input: {
    apiUrl: string;
    appId: string;
    privateKey: string;
    installationId: string;
  }) {
    const jwt = this.buildGithubAppJwt(input.appId, input.privateKey);
    const response = await fetch(
      `${input.apiUrl.replace(/\/+$/, "")}/app/installations/${encodeURIComponent(input.installationId)}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(
        `Failed to create GitHub installation token (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    return (await response.json()) as {
      token: string;
      expires_at?: string;
    };
  }

  private async fetchGithubInstallationRepositories(apiUrl: string, token: string) {
    const response = await fetch(`${apiUrl.replace(/\/+$/, "")}/installation/repositories`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(
        `Failed to list installation repositories (${response.status}): ${text.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as GithubInstallationRepositoriesPayload;
    return payload.repositories ?? [];
  }

  private async getGithubAppInstallationContext(organizationId: string) {
    const settings = await this.getRawOrgGithubAppSettings(organizationId);

    if (!settings?.installationId || !settings.appId || !settings.privateKeyCiphertext) {
      throw new BadRequestException(
        "GitHub App installation is required before listing repositories",
      );
    }

    const apiUrl = this.getGithubApiUrl(settings);
    const installationToken = await this.createGithubInstallationToken({
      apiUrl,
      appId: settings.appId,
      privateKey: decryptSecret(settings.privateKeyCiphertext),
      installationId: settings.installationId,
    });

    return {
      settings,
      apiUrl,
      token: installationToken.token,
    };
  }

  private async getGithubAppBackedConnection(
    organizationId: string,
    connection: RepoConnectionInput,
  ): Promise<RepoConnectionInput | null> {
    const githubSettings = await this.getRawOrgGithubAppSettings(organizationId);

    if (
      !githubSettings?.installationId ||
      !githubSettings.appId ||
      !githubSettings.privateKeyCiphertext
    ) {
      return null;
    }

    const apiUrl = this.getGithubApiUrl(githubSettings, connection.apiUrl);
    const installationToken = await this.createGithubInstallationToken({
      apiUrl,
      appId: githubSettings.appId,
      privateKey: decryptSecret(githubSettings.privateKeyCiphertext),
      installationId: githubSettings.installationId,
    });

    return {
      ...connection,
      htmlUrl:
        connection.htmlUrl ??
        githubSettings.htmlUrl ??
        (githubSettings.mode === "cloud" ? "https://github.com" : null),
      apiUrl,
      gitUser: connection.gitUser ?? githubSettings.gitUser ?? null,
      gitPort: connection.gitPort ?? githubSettings.gitPort ?? null,
      token: installationToken.token,
    };
  }

  private verifyGithubWebhookSignature(secret: string, rawBody: string, signature?: string) {
    if (!signature?.startsWith("sha256=")) {
      return false;
    }

    const expected = Buffer.from(
      `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`,
      "utf8",
    );
    const actual = Buffer.from(signature, "utf8");

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(expected, actual);
  }
}
