import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq, lt, ne } from "drizzle-orm";
import { SourcemapResolverService } from "../artifacts/sourcemap-resolver.service";
import { getAllFrames } from "../common/grouping";
import { DATABASE } from "../database/database.provider";
import type { DatabaseClient } from "../database/database.provider";
import { events, issues, releaseCommits, releases } from "../database/schema";
import { IntegrationsService } from "../integrations/integrations.service";
import { VcsRequestError } from "../integrations/vcs/vcs-provider.interface";
import { VcsFactory } from "../integrations/vcs/vcs.factory";
import { JobsService } from "../jobs/jobs.service";
import { commitShaFromVersion, rankSuspectCommits } from "./suspect-commits";

export const RELEASE_COMMITS_JOB = "release_commits_sync";
/** Most commits stored per release: a release range rarely needs more to find a suspect. */
export const MAX_RELEASE_COMMITS = 50;
const MAX_MESSAGE_LENGTH = 4000;

type ReleaseRecord = typeof releases.$inferSelect;
export type ReleaseCommitRecord = typeof releaseCommits.$inferSelect;

export type CommitsStatus = "pending" | "synced" | "unavailable" | "failed";

function effectiveSha(release: Pick<ReleaseRecord, "commitSha" | "version">) {
  return release.commitSha ?? commitShaFromVersion(release.version);
}

function commitDto(commit: ReleaseCommitRecord) {
  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    title: commit.message.split("\n")[0].slice(0, 200),
    message: commit.message,
    authorName: commit.authorName,
    authorLogin: commit.authorLogin,
    committedAt: commit.committedAt,
    url: commit.url,
    files: commit.files,
    filesTruncated: commit.filesTruncated,
  };
}

@Injectable()
export class ReleaseCommitsService {
  private readonly logger = new Logger(ReleaseCommitsService.name);

  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly integrationsService: IntegrationsService,
    private readonly vcsFactory: VcsFactory,
    private readonly jobsService: JobsService,
    private readonly sourcemapResolverService: SourcemapResolverService,
  ) {}

  /** Queues a fetch of the release's commits. A fetch already queued is not duplicated. */
  async requestSync(release: ReleaseRecord): Promise<CommitsStatus | null> {
    if (!effectiveSha(release)) return release.commitsStatus as CommitsStatus | null;
    await this.db
      .update(releases)
      .set({ commitsStatus: "pending", commitsError: null })
      .where(eq(releases.id, release.id));
    await this.jobsService.enqueue(RELEASE_COMMITS_JOB, { releaseId: release.id }, new Date(), {
      dedupeKey: release.id,
      organizationId: release.organizationId,
      projectId: release.projectId,
    });
    return "pending";
  }

  /** Records the commit a release was built from, and fetches its commits when it changed. */
  async setCommitSha(release: ReleaseRecord, commitSha: string | undefined) {
    const sha = commitSha?.toLowerCase();
    if (sha && sha !== release.commitSha) {
      const [updated] = await this.db
        .update(releases)
        .set({ commitSha: sha, updatedAt: new Date() })
        .where(eq(releases.id, release.id))
        .returning();
      await this.requestSync(updated);
      return { ...updated, commitsStatus: "pending" };
    }
    if (release.commitsStatus === null && effectiveSha(release)) {
      await this.requestSync(release);
      return { ...release, commitsStatus: "pending" };
    }
    return release;
  }

  /** Job: reads the commits between the previous release and this one from the repository. */
  async sync(releaseId: string): Promise<void> {
    const [release] = await this.db
      .select()
      .from(releases)
      .where(eq(releases.id, releaseId))
      .limit(1);
    if (!release) return;
    const head = effectiveSha(release);
    if (!head) {
      await this.finish(release.id, "unavailable", "The release has no commit SHA.");
      return;
    }
    const connection = await this.integrationsService.getAutofixConnection(
      release.projectId,
      release.organizationId,
    );
    if (!connection) {
      await this.finish(release.id, "unavailable", "No repository is connected to this project.");
      return;
    }

    const base = await this.previousReleaseSha(release, head);
    let result;
    try {
      result = await this.vcsFactory
        .getProvider(connection.provider as "github" | "gitlab")
        .listCommits(connection.input, { head, base, limit: MAX_RELEASE_COMMITS });
    } catch (error) {
      if (error instanceof VcsRequestError && [401, 403, 404, 422].includes(error.status)) {
        const reason =
          error.status === 404 || error.status === 422
            ? `Commit ${head.slice(0, 7)} was not found in ${connection.repoIdentifier}.`
            : `The repository connection cannot read commits (HTTP ${error.status}).`;
        await this.finish(release.id, "failed", reason);
        return;
      }
      // Network or server errors: the job runner retries.
      throw error;
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(releaseCommits).where(eq(releaseCommits.releaseId, release.id));
      if (result.commits.length > 0) {
        await tx.insert(releaseCommits).values(
          result.commits.map((commit, position) => ({
            organizationId: release.organizationId,
            projectId: release.projectId,
            releaseId: release.id,
            position,
            sha: commit.sha.toLowerCase(),
            message: commit.message.slice(0, MAX_MESSAGE_LENGTH),
            authorName: commit.authorName,
            authorEmail: commit.authorEmail,
            authorLogin: commit.authorLogin,
            committedAt: commit.committedAt ? new Date(commit.committedAt) : null,
            url: commit.url,
            files: commit.files,
            filesTruncated: commit.filesTruncated,
          })),
        );
      }
      await tx
        .update(releases)
        .set({
          commitsStatus: "synced",
          commitsError: null,
          commitsBaseSha: result.base,
          commitsTruncated: result.truncated,
          commitsSyncedAt: new Date(),
        })
        .where(eq(releases.id, release.id));
    });
  }

  async listForRelease(projectId: string, version: string) {
    const release = await this.getRelease(projectId, version);
    // A release created by ingestion with a SHA version has never been read: start now.
    if (release.commitsStatus === null && effectiveSha(release)) {
      release.commitsStatus = await this.requestSync(release);
    }
    const commits = await this.db
      .select()
      .from(releaseCommits)
      .where(eq(releaseCommits.releaseId, release.id))
      .orderBy(asc(releaseCommits.position));
    return {
      commitSha: effectiveSha(release),
      status: release.commitsStatus,
      error: release.commitsError,
      baseSha: release.commitsBaseSha,
      truncated: release.commitsTruncated,
      syncedAt: release.commitsSyncedAt,
      commits: commits.map(commitDto),
    };
  }

  async getRelease(projectId: string, version: string): Promise<ReleaseRecord> {
    const [release] = await this.db
      .select()
      .from(releases)
      .where(and(eq(releases.projectId, projectId), eq(releases.version, version)))
      .limit(1);
    if (!release) throw new NotFoundException("Release not found");
    return release;
  }

  /**
   * Commits of the issue's release that touched files in its latest stack trace. Fetches the
   * release's commits on first use, so releases created by ingestion work without the CLI.
   */
  async suspectsForIssue(projectId: string, issueId: string) {
    const [issue] = await this.db
      .select({ id: issues.id, releaseId: issues.releaseId })
      .from(issues)
      .where(and(eq(issues.projectId, projectId), eq(issues.id, issueId)))
      .limit(1);
    if (!issue) throw new NotFoundException("Issue not found");

    const empty = (
      status: string,
      reason: string | null,
      release: ReleaseRecord | null = null,
    ) => ({
      status,
      reason,
      release: release ? { version: release.version, commitSha: effectiveSha(release) } : null,
      suspects: [],
    });
    if (!issue.releaseId) return empty("unavailable", "Events of this issue have no release.");
    const [release] = await this.db
      .select()
      .from(releases)
      .where(eq(releases.id, issue.releaseId))
      .limit(1);
    if (!release) return empty("unavailable", "The issue's release was deleted.");
    if (!effectiveSha(release)) {
      return empty(
        "unavailable",
        "The release has no commit SHA. Send it with the SpicyTrack CLI, or use the SHA as the release version.",
        release,
      );
    }
    if (release.commitsStatus === null) {
      await this.requestSync(release);
      return empty("pending", null, release);
    }
    if (release.commitsStatus !== "synced") {
      return empty(release.commitsStatus, release.commitsError, release);
    }

    const [event] = await this.db
      .select({
        rawPayload: events.rawPayload,
        releaseId: events.releaseId,
        sdkName: events.sdkName,
        platform: events.platform,
      })
      .from(events)
      .where(and(eq(events.projectId, projectId), eq(events.issueId, issueId)))
      .orderBy(desc(events.timestamp))
      .limit(1);
    const commits = await this.db
      .select()
      .from(releaseCommits)
      .where(eq(releaseCommits.releaseId, release.id))
      .orderBy(asc(releaseCommits.position));
    if (!event || commits.length === 0) return empty("synced", null, release);

    const rawFrames = getAllFrames(event.rawPayload as Record<string, unknown>);
    const resolved = await this.sourcemapResolverService.resolveFrames({
      releaseId: event.releaseId,
      frames: rawFrames,
      sdkName: event.sdkName,
      platform: event.platform,
    });
    const frames = rawFrames.map((frame, index) => ({
      path:
        (resolved[index]?.resolved ? resolved[index].filename : null) ??
        frame.absPath ??
        frame.filename ??
        "",
      function: resolved[index]?.function ?? frame.function ?? null,
      lineno: resolved[index]?.lineno ?? frame.lineno ?? null,
      inApp: frame.inApp ?? null,
    }));

    return {
      status: "synced",
      reason: null,
      release: { version: release.version, commitSha: effectiveSha(release) },
      suspects: rankSuspectCommits(frames, commits).map((suspect) => ({
        ...commitDto(suspect.commit),
        score: suspect.score,
        matches: suspect.matches,
      })),
    };
  }

  /** The commit of the latest earlier release with a different one, to bound the range. */
  private async previousReleaseSha(release: ReleaseRecord, head: string): Promise<string | null> {
    const candidates = await this.db
      .select({ commitSha: releases.commitSha, version: releases.version })
      .from(releases)
      .where(
        and(
          eq(releases.projectId, release.projectId),
          ne(releases.id, release.id),
          lt(releases.createdAt, release.createdAt),
        ),
      )
      .orderBy(desc(releases.createdAt))
      .limit(20);
    for (const candidate of candidates) {
      const sha = effectiveSha(candidate);
      if (sha && sha !== head) return sha;
    }
    return null;
  }

  private async finish(releaseId: string, status: CommitsStatus, error: string) {
    this.logger.warn(`Release ${releaseId}: commits ${status}: ${error}`);
    await this.db
      .update(releases)
      .set({ commitsStatus: status, commitsError: error, commitsSyncedAt: new Date() })
      .where(eq(releases.id, releaseId));
  }
}
