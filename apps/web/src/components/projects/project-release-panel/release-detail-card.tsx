import { CircleDot } from "lucide-react";

import type { ProjectReleaseDetailDto, ReleaseArtifactDto } from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import { ReleaseCommitsSection } from "@/components/commits/release-commits-section";

import { ReleaseArtifactsSection } from "./release-artifacts-section";
import { ReleaseIssuesSection } from "./release-issues-section";
import { compactDate } from "./utils";

function ReleaseDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading release" className="grid gap-4 p-6" role="status">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function ReleaseDetailCard({
  orgSlug,
  projectSlug,
  hasReleases,
  selectedReleaseVersion,
  releaseDetail,
  isLoading,
  error,
  onRetry,
  artifacts,
  artifactsLoading,
  artifactsError,
  onRetryArtifacts,
  uploadError,
  isUploadingArtifact,
  onOpenIssue,
  onUploadArtifact,
  onDeleteArtifact,
}: {
  orgSlug: string;
  projectSlug: string;
  hasReleases: boolean;
  selectedReleaseVersion: string;
  releaseDetail: ProjectReleaseDetailDto | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  artifacts: ReleaseArtifactDto[];
  artifactsLoading: boolean;
  artifactsError: unknown;
  onRetryArtifacts: () => void;
  uploadError: string | null;
  isUploadingArtifact: boolean;
  onOpenIssue: (issueId: string) => void;
  onUploadArtifact: React.FormEventHandler<HTMLFormElement>;
  onDeleteArtifact: (artifactId: string) => Promise<void>;
}) {
  if (isLoading) {
    return (
      <Card className="min-w-0 overflow-hidden" data-testid="release-detail-card">
        <ReleaseDetailSkeleton />
      </Card>
    );
  }

  if (selectedReleaseVersion && error) {
    return (
      <Card className="min-w-0 overflow-hidden p-6" data-testid="release-detail-card">
        <QueryError error={error} onRetry={onRetry} title="Could not load this release" />
      </Card>
    );
  }

  if (!selectedReleaseVersion || !releaseDetail) {
    return (
      <Card className="min-w-0 overflow-hidden p-6" data-testid="release-detail-card">
        <EmptyState
          description={
            hasReleases
              ? "Select a release to inspect affected issues and upload artifacts."
              : "Create a release to upload source maps before your next deploy."
          }
          icon={CircleDot}
          title="Release intelligence starts here"
        />
      </Card>
    );
  }

  const { release, issues } = releaseDetail;

  return (
    <Card className="min-w-0 overflow-hidden" data-testid="release-detail-card">
      <CardHeader className="min-w-0">
        <CardTitle className="break-all">{release.version}</CardTitle>
        <CardDescription>
          {release.eventCount} events · first seen {compactDate(release.firstSeenAt)}
          <span className="hidden sm:inline"> · last seen {compactDate(release.lastSeenAt)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <ReleaseIssuesSection issues={issues} onOpenIssue={onOpenIssue} />
        <ReleaseCommitsSection
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          releaseVersion={release.version}
        />
        <ReleaseArtifactsSection
          artifacts={artifacts}
          error={artifactsError}
          isLoading={artifactsLoading}
          isUploading={isUploadingArtifact}
          onDelete={onDeleteArtifact}
          onRetry={onRetryArtifacts}
          onUpload={onUploadArtifact}
          releaseVersion={release.version}
          uploadError={uploadError}
        />
      </CardContent>
    </Card>
  );
}

export { ReleaseDetailCard };
