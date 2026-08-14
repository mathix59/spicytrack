import { projectKeys } from "../database/schema";

function withDerivedKeyFields(
  key: typeof projectKeys.$inferSelect,
  publicBaseUrl: string | undefined,
  projectPublicId: number,
) {
  return {
    ...key,
    dsn: buildProjectDsn({
      publicBaseUrl,
      projectId: projectPublicId,
      publicKey: key.publicKey,
    }),
    envelopeUrl: buildEnvelopeUrl({
      publicBaseUrl,
      projectId: projectPublicId,
    }),
  };
}

function normalizeBaseUrl(publicBaseUrl?: string) {
  return (publicBaseUrl ?? "http://localhost:3002").replace(/\/+$/, "");
}

function buildProjectDsn(input: { publicBaseUrl?: string; projectId: number; publicKey: string }) {
  const url = new URL(normalizeBaseUrl(input.publicBaseUrl));
  url.username = input.publicKey;
  url.pathname = `/${input.projectId}`;
  return url.toString();
}

function buildEnvelopeUrl(input: { publicBaseUrl?: string; projectId: number }) {
  return `${normalizeBaseUrl(input.publicBaseUrl)}/api/${input.projectId}/envelope/`;
}

export { buildEnvelopeUrl, buildProjectDsn, normalizeBaseUrl, withDerivedKeyFields };
