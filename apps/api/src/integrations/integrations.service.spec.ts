import { encryptSecret } from "../common/secrets";
import { IntegrationsService } from "./integrations.service";
import type { VcsProvider } from "./vcs/vcs-provider.interface";

function createSelectChain(rows: unknown[]) {
  return {
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(async () => rows.shift() ?? []),
      })),
    })),
  };
}

describe("IntegrationsService", () => {
  const validateConnection = jest.fn<
    ReturnType<VcsProvider["validateConnection"]>,
    Parameters<VcsProvider["validateConnection"]>
  >();
  const provider = {
    validateConnection,
    getAuthenticatedCloneUrl: jest.fn(),
    createPullRequest: jest.fn(),
    mergePullRequest: jest.fn(),
  } as unknown as VcsProvider;

  const vcsFactory = {
    getProvider: jest.fn(() => provider),
  };

  const auditService = {
    record: jest.fn(),
  };

  const githubSettings = {
    id: "settings-1",
    organizationId: "org-1",
    mode: "cloud",
    htmlUrl: null,
    apiUrl: null,
    gitUser: null,
    gitPort: null,
    appSlug: "spicytrack-app",
    appId: "123456",
    clientId: null,
    installationId: "987654",
    installationAccountLogin: "acme",
    installationAccountType: "Organization",
    clientSecretCiphertext: null,
    privateKeyCiphertext: "",
    webhookSecretCiphertext: null,
    updatedByUserId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.SECRETS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    delete process.env.VCS_ALLOWED_HOSTS;
    vcsFactory.getProvider.mockReturnValue(provider);
    validateConnection.mockResolvedValue({
      defaultBranch: "main",
      webUrl: "https://github.com/acme/spicytrack",
    });
    global.fetch = jest.fn() as unknown as typeof fetch;
    githubSettings.privateKeyCiphertext = encryptSecret("test-private-key");
  });

  it("does not reuse a stored token when a connection test changes the endpoint", async () => {
    process.env.VCS_ALLOWED_HOSTS = "github.corp.example";
    const connection = {
      id: "conn-1",
      organizationId: "org-1",
      projectId: "project-1",
      provider: "github",
      baseUrl: null,
      htmlUrl: "https://github.com",
      apiUrl: "https://api.github.com",
      gitUser: null,
      gitPort: null,
      repoIdentifier: "acme/spicytrack",
      tokenCiphertext: encryptSecret("stored-token"),
      defaultBranch: "main",
      lastValidatedAt: new Date(),
      createdByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {
      select: jest.fn(() => createSelectChain([[connection]])),
    };
    const service = new IntegrationsService(
      db as never,
      vcsFactory as never,
      auditService as never,
    );

    await expect(
      service.testConnection({
        projectId: "project-1",
        provider: "github",
        htmlUrl: "https://github.corp.example",
        apiUrl: "https://github.corp.example/api/v3",
      }),
    ).rejects.toThrow("A new token is required when changing a VCS endpoint URL");
    expect(validateConnection).not.toHaveBeenCalled();
  });

  it("does not reuse a stored token when an update changes the endpoint", async () => {
    process.env.VCS_ALLOWED_HOSTS = "gitlab.corp.example";
    const connection = {
      id: "conn-1",
      organizationId: "org-1",
      projectId: "project-1",
      provider: "gitlab",
      baseUrl: "https://gitlab.com",
      htmlUrl: null,
      apiUrl: null,
      gitUser: null,
      gitPort: null,
      repoIdentifier: "acme/spicytrack",
      tokenCiphertext: encryptSecret("stored-token"),
      defaultBranch: "main",
      lastValidatedAt: new Date(),
      createdByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const db = {
      select: jest.fn(() => createSelectChain([[connection]])),
    };
    const service = new IntegrationsService(
      db as never,
      vcsFactory as never,
      auditService as never,
    );

    await expect(
      service.upsertConnection({
        organizationId: "org-1",
        projectId: "project-1",
        actorUserId: "user-1",
        provider: "gitlab",
        baseUrl: "https://gitlab.corp.example",
        htmlUrl: null,
        apiUrl: null,
        gitUser: null,
        gitPort: null,
        repoIdentifier: "acme/spicytrack",
      }),
    ).rejects.toThrow("A new token is required when changing a VCS endpoint URL");
    expect(validateConnection).not.toHaveBeenCalled();
  });

  it("stores GitHub repo connections without a persisted PAT when the GitHub App is active", async () => {
    const inserted = {
      id: "conn-1",
      organizationId: "org-1",
      projectId: "project-1",
      provider: "github",
      baseUrl: null,
      htmlUrl: null,
      apiUrl: null,
      gitUser: null,
      gitPort: null,
      repoIdentifier: "acme/spicytrack",
      tokenCiphertext: null,
      defaultBranch: "main",
      lastValidatedAt: new Date(),
      createdByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertValues = jest.fn(() => ({
      returning: jest.fn(async () => [inserted]),
    }));
    const db = {
      select: jest
        .fn()
        .mockImplementationOnce(() => createSelectChain([[null]]))
        .mockImplementationOnce(() => createSelectChain([[githubSettings]])),
      insert: jest.fn(() => ({
        values: insertValues,
      })),
      update: jest.fn(),
      delete: jest.fn(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "ghs_installation_token" }),
      text: async () => "",
    });

    const service = new IntegrationsService(
      db as never,
      vcsFactory as never,
      auditService as never,
    );
    jest.spyOn(service as any, "buildGithubAppJwt").mockReturnValue("jwt");

    const result = await service.upsertConnection({
      organizationId: "org-1",
      projectId: "project-1",
      actorUserId: "user-1",
      provider: "github",
      baseUrl: null,
      htmlUrl: null,
      apiUrl: null,
      gitUser: null,
      gitPort: null,
      repoIdentifier: "acme/spicytrack",
    });

    expect(validateConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        repoIdentifier: "acme/spicytrack",
        token: "ghs_installation_token",
      }),
    );
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenCiphertext: null,
      }),
    );
    expect(result.tokenSet).toBe(false);
  });

  it("returns an installation token for Autofix when the repo connection has no stored token", async () => {
    const connection = {
      id: "conn-1",
      organizationId: "org-1",
      projectId: "project-1",
      provider: "github",
      baseUrl: null,
      htmlUrl: null,
      apiUrl: null,
      gitUser: null,
      gitPort: null,
      repoIdentifier: "acme/spicytrack",
      tokenCiphertext: null,
      defaultBranch: "main",
      lastValidatedAt: new Date(),
      createdByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const db = {
      select: jest
        .fn()
        .mockImplementationOnce(() => createSelectChain([[connection]]))
        .mockImplementationOnce(() => createSelectChain([[githubSettings]])),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "ghs_installation_token" }),
      text: async () => "",
    });

    const service = new IntegrationsService(
      db as never,
      vcsFactory as never,
      auditService as never,
    );
    jest.spyOn(service as any, "buildGithubAppJwt").mockReturnValue("jwt");

    const result = await service.getAutofixConnection("project-1", "org-1");

    expect(result?.input.token).toBe("ghs_installation_token");
    expect(result?.input.apiUrl).toBe("https://api.github.com");
    expect(result?.input.htmlUrl).toBe("https://github.com");
  });
});
