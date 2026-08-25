import { open } from "node:fs/promises";

function apiBase(url) {
  return `${url.replace(/\/+$/, "")}${url.replace(/\/+$/, "").endsWith("/api") ? "" : "/api"}`;
}

async function apiRequest(config, pathname, init = {}) {
  const response = await fetch(`${apiBase(config.url)}${pathname}`, {
    ...init,
    headers: { authorization: `Bearer ${config.token}`, ...init.headers },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${init.method ?? "GET"} ${pathname} failed (${response.status}): ${detail}`);
  }
  return response;
}

function projectPath(config) {
  return `/organizations/${encodeURIComponent(config.organization)}/projects/${encodeURIComponent(config.project)}`;
}

export async function verifyConnection(config) {
  const response = await apiRequest(config, projectPath(config));
  return response.json();
}

export async function createRelease(config, release) {
  await apiRequest(config, `${projectPath(config)}/releases/${encodeURIComponent(release)}`, {
    method: "PUT",
  });
}

export async function uploadArtifact(config, release, artifact) {
  const file = await open(artifact.filename, "r");
  try {
    const body = new FormData();
    body.append("file", new Blob([await file.readFile()]), artifact.artifactName.split("/").at(-1));
    await apiRequest(
      config,
      `${projectPath(config)}/releases/${encodeURIComponent(release)}/artifacts?artifactName=${encodeURIComponent(artifact.artifactName)}`,
      { method: "POST", body },
    );
  } finally {
    await file.close();
  }
}
