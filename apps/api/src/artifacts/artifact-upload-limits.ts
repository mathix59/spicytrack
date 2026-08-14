export const DEFAULT_ARTIFACT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function artifactMaxUploadBytes(environment: NodeJS.ProcessEnv = process.env): number {
  const raw = environment.ARTIFACT_MAX_UPLOAD_BYTES;
  if (raw === undefined || raw.trim() === "") return DEFAULT_ARTIFACT_MAX_UPLOAD_BYTES;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("ARTIFACT_MAX_UPLOAD_BYTES must be a positive integer");
  }
  return value;
}
