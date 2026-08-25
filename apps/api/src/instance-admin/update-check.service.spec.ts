import { BadGatewayException } from "@nestjs/common";
import { resolveUpdateManifestUrl, UpdateCheckService } from "./update-check.service";

describe("UpdateCheckService", () => {
  const originalUrl = process.env.SPICYTRACK_UPDATE_MANIFEST_URL;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalUrl === undefined) delete process.env.SPICYTRACK_UPDATE_MANIFEST_URL;
    else process.env.SPICYTRACK_UPDATE_MANIFEST_URL = originalUrl;
  });

  it("uses the official release manifest by default and can be disabled", () => {
    delete process.env.SPICYTRACK_UPDATE_MANIFEST_URL;
    expect(resolveUpdateManifestUrl()).toContain("mathix59/spicytrack/main/apps/api/package.json");

    process.env.SPICYTRACK_UPDATE_MANIFEST_URL = "disabled";
    expect(resolveUpdateManifestUrl()).toBeNull();
  });

  it("returns and caches validated release information", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ version: "1.2.3" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const service = new UpdateCheckService();

    const first = await service.getLatest();
    const second = await service.getLatest();

    expect(first).toMatchObject({
      enabled: true,
      latestVersion: "1.2.3",
      releaseNotesUrl: "https://github.com/mathix59/spicytrack/releases/tag/v1.2.3",
    });
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid remote manifest", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ version: "latest" }), { status: 200 }));

    await expect(new UpdateCheckService().getLatest()).rejects.toBeInstanceOf(BadGatewayException);
  });
});
