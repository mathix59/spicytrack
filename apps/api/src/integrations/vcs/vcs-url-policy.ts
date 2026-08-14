import { BadRequestException } from "@nestjs/common";
import type { RepoConnectionInput, VcsProviderKind } from "./vcs-provider.interface";

type VcsEndpointInput = Pick<RepoConnectionInput, "baseUrl" | "htmlUrl" | "apiUrl">;

const OFFICIAL_HOSTS: Record<VcsProviderKind, ReadonlySet<string>> = {
  github: new Set(["github.com", "api.github.com"]),
  gitlab: new Set(["gitlab.com"]),
};

function allowedCustomHosts(): ReadonlySet<string> {
  return new Set(
    (process.env.VCS_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );
}

function endpointValues(provider: VcsProviderKind, input: VcsEndpointInput) {
  return provider === "github" ? [input.baseUrl, input.htmlUrl, input.apiUrl] : [input.baseUrl];
}

function normalizedEndpoint(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}

export function assertAllowedVcsEndpoints(
  provider: VcsProviderKind,
  input: VcsEndpointInput,
): void {
  const allowedHosts = new Set([...OFFICIAL_HOSTS[provider], ...allowedCustomHosts()]);

  for (const value of endpointValues(provider, input)) {
    if (!value) continue;

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException("VCS endpoint URLs must be absolute URLs");
    }

    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && process.env.VCS_ALLOW_INSECURE_HTTP === "true")
    ) {
      throw new BadRequestException("VCS endpoint URLs must use HTTPS");
    }
    if (url.username || url.password) {
      throw new BadRequestException("VCS endpoint URLs must not contain credentials");
    }
    if (!allowedHosts.has(url.hostname.toLowerCase())) {
      throw new BadRequestException(
        "VCS endpoint host is not allowed; add trusted Enterprise hosts to VCS_ALLOWED_HOSTS",
      );
    }
  }
}

export function vcsEndpointsChanged(
  provider: VcsProviderKind,
  previous: VcsEndpointInput,
  next: VcsEndpointInput,
): boolean {
  const previousValues = endpointValues(provider, previous).map(normalizedEndpoint);
  const nextValues = endpointValues(provider, next).map(normalizedEndpoint);
  return previousValues.some((value, index) => value !== nextValues[index]);
}
