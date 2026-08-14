import {
  artifactMaxUploadBytes,
  DEFAULT_ARTIFACT_MAX_UPLOAD_BYTES,
} from "./artifact-upload-limits";

describe("artifactMaxUploadBytes", () => {
  it("defaults to 20 MiB", () => {
    expect(artifactMaxUploadBytes({})).toBe(DEFAULT_ARTIFACT_MAX_UPLOAD_BYTES);
  });

  it("accepts a positive byte limit", () => {
    expect(artifactMaxUploadBytes({ ARTIFACT_MAX_UPLOAD_BYTES: "52428800" })).toBe(
      50 * 1024 * 1024,
    );
  });

  it.each(["0", "-1", "1.5", "nope"])("rejects invalid value %s", (value) => {
    expect(() => artifactMaxUploadBytes({ ARTIFACT_MAX_UPLOAD_BYTES: value })).toThrow(
      "ARTIFACT_MAX_UPLOAD_BYTES must be a positive integer",
    );
  });
});
