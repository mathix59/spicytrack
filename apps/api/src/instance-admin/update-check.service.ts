import { BadGatewayException, Injectable } from "@nestjs/common";

const DEFAULT_MANIFEST_URL =
  "https://raw.githubusercontent.com/mathix59/spicytrack/main/apps/api/package.json";
const CACHE_MS = 6 * 60 * 60 * 1000;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

type UpdateInformation = {
  latestVersion: string;
  releaseNotesUrl: string;
  upgradeGuideUrl: string;
  checkedAt: string;
};

export function resolveUpdateManifestUrl() {
  const configured = process.env.SPICYTRACK_UPDATE_MANIFEST_URL?.trim();
  if (configured && ["off", "disabled"].includes(configured.toLowerCase())) return null;
  return configured || DEFAULT_MANIFEST_URL;
}

@Injectable()
export class UpdateCheckService {
  private cached: { value: UpdateInformation; expiresAt: number } | null = null;

  async getLatest() {
    const manifestUrl = resolveUpdateManifestUrl();
    if (!manifestUrl) return { enabled: false as const };
    if (this.cached && this.cached.expiresAt > Date.now()) {
      return { enabled: true as const, ...this.cached.value };
    }

    try {
      const response = await fetch(manifestUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`manifest returned HTTP ${response.status}`);
      const manifest = (await response.json()) as { version?: unknown };
      if (typeof manifest.version !== "string" || !VERSION_PATTERN.test(manifest.version)) {
        throw new Error("manifest contains an invalid version");
      }
      const value: UpdateInformation = {
        latestVersion: manifest.version,
        releaseNotesUrl: `https://github.com/mathix59/spicytrack/releases/tag/v${manifest.version}`,
        upgradeGuideUrl: "https://docs.spicytrack.io/operations/production#upgrades",
        checkedAt: new Date().toISOString(),
      };
      this.cached = { value, expiresAt: Date.now() + CACHE_MS };
      return { enabled: true as const, ...value };
    } catch (error) {
      throw new BadGatewayException(
        `Could not check for SpicyTrack updates: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }
}
