import { BadRequestException } from "@nestjs/common";

import {
  normalizeBrowserIngestOrigin,
  normalizeBrowserIngestOrigins,
} from "./browser-ingest-origins";

describe("browser ingest origins", () => {
  it("normalizes and deduplicates exact HTTP(S) origins", () => {
    expect(
      normalizeBrowserIngestOrigins([
        " https://APP.example.com:443 ",
        "https://app.example.com",
        "http://localhost:5173",
      ]),
    ).toEqual(["https://app.example.com", "http://localhost:5173"]);
  });

  it.each([
    "javascript:alert(1)",
    "https://example.com/path",
    "https://user:pass@example.com",
    "https://example.com?query=1",
  ])("rejects values that are not exact HTTP(S) origins: %s", (value) => {
    expect(() => normalizeBrowserIngestOrigin(value)).toThrow(BadRequestException);
  });

  it("keeps an empty list as the allow-all configuration", () => {
    expect(normalizeBrowserIngestOrigins([])).toEqual([]);
  });
});
