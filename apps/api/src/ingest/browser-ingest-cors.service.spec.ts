import type { DatabaseClient } from "../database/database.provider";
import { BrowserIngestCorsService } from "./browser-ingest-cors.service";

function databaseWithOrigins(browserAllowedOrigins: string[]) {
  const limit = jest.fn().mockResolvedValue([{ browserAllowedOrigins }]);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });
  const select = jest.fn().mockReturnValue({ from });
  return { database: { select } as unknown as DatabaseClient, select };
}

function request(origin: string, url = "/api/42/envelope/?sentry_key=public") {
  return { headers: { origin }, url } as never;
}

describe("BrowserIngestCorsService", () => {
  it("reflects any valid origin when the project allowlist is empty", async () => {
    const { database } = databaseWithOrigins([]);
    const service = new BrowserIngestCorsService(database);

    await expect(
      service.optionsFor(request("https://frontend.example.com")),
    ).resolves.toMatchObject({ origin: "https://frontend.example.com", credentials: false });
  });

  it("allows only configured project origins", async () => {
    const { database } = databaseWithOrigins(["https://frontend.example.com"]);
    const service = new BrowserIngestCorsService(database);

    await expect(
      service.optionsFor(request("https://frontend.example.com")),
    ).resolves.toMatchObject({ origin: "https://frontend.example.com" });
    await expect(service.optionsFor(request("https://other.example.com"))).resolves.toEqual({
      origin: false,
      credentials: false,
      methods: ["POST", "OPTIONS"],
      maxAge: 600,
    });
  });

  it("does not query project configuration for non-ingest routes", async () => {
    const { database, select } = databaseWithOrigins([]);
    const service = new BrowserIngestCorsService(database);

    await expect(
      service.optionsFor(request("https://frontend.example.com", "/api/health")),
    ).resolves.toEqual({ origin: false });
    expect(select).not.toHaveBeenCalled();
  });
});
