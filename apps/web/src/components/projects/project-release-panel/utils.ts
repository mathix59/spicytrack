import { formatLocalDateTime, renderNullableText } from "@/lib/utils";

function formatBytes(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function compactDate(value: string | null | undefined) {
  if (!value) {
    return "n/a";
  }

  return formatLocalDateTime(value);
}

/** The project's issue list, filtered to one release, any status, most seen first. */
function releaseIssuesHref(orgSlug: string, projectSlug: string, releaseVersion: string) {
  const params = new URLSearchParams({
    tab: "observability",
    release: releaseVersion,
    status: "all",
    sortBy: "timesSeen",
  });
  return `/orgs/${orgSlug}/projects/${projectSlug}?${params.toString()}`;
}

/**
 * "checkout-ui@2.4.1" → package "checkout-ui@", version "2.4.1", so a list can shorten the
 * package and keep the version. Without a package, the whole string is the version.
 */
function splitReleaseVersion(release: string) {
  const at = release.lastIndexOf("@");
  if (at <= 0 || at === release.length - 1) return { packageName: "", version: release };
  return { packageName: release.slice(0, at + 1), version: release.slice(at + 1) };
}

/** Most recently seen first; releases never seen yet sort by creation, after the seen ones. */
function sortReleasesByLastSeen<T extends { lastSeenAt?: string | null; createdAt: string }>(
  releases: T[],
) {
  const time = (value: string | null | undefined) => (value ? Date.parse(value) : -Infinity);
  return [...releases].sort(
    (a, b) => time(b.lastSeenAt) - time(a.lastSeenAt) || time(b.createdAt) - time(a.createdAt),
  );
}

export {
  compactDate,
  formatBytes,
  releaseIssuesHref,
  renderNullableText,
  sortReleasesByLastSeen,
  splitReleaseVersion,
};
