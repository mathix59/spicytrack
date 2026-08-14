import { BadRequestException } from "@nestjs/common";

const MAX_BROWSER_INGEST_ORIGINS = 50;

function normalizeBrowserIngestOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BadRequestException(`Invalid browser ingest origin: ${value}`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new BadRequestException(
      `Browser ingest origins must be HTTP(S) origins without a path: ${value}`,
    );
  }

  return url.origin;
}

function normalizeBrowserIngestOrigins(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_BROWSER_INGEST_ORIGINS) {
    throw new BadRequestException(
      `browserAllowedOrigins must be an array with at most ${MAX_BROWSER_INGEST_ORIGINS} entries`,
    );
  }
  if (value.some((item) => typeof item !== "string")) {
    throw new BadRequestException("browserAllowedOrigins must be an array of strings");
  }

  return [...new Set(value.map((item) => normalizeBrowserIngestOrigin(item)))];
}

export { normalizeBrowserIngestOrigin, normalizeBrowserIngestOrigins };
