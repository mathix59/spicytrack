import { ArrowUpRight, Boxes, CircleDot, PackageOpen, UploadCloud } from "lucide-react";

import type {
  IssueDto,
  ProjectReleaseDetailDto,
  ProjectReleaseDto,
  ReleaseArtifactDto,
} from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { compactDate, formatBytes, renderNullableText } from "./utils";

function ReleaseDetailCard({
  releases,
  selectedReleaseVersion,
  releaseDetail,
  artifacts,
  uploadError,
  isUploadingArtifact,
  isDeletingArtifact,
  onOpenIssue,
  onUploadArtifact,
  onDeleteArtifact,
}: {
  releases: ProjectReleaseDto[];
  selectedReleaseVersion: string;
  releaseDetail: ProjectReleaseDetailDto | undefined;
  artifacts: ReleaseArtifactDto[];
  uploadError: string | null;
  isUploadingArtifact: boolean;
  isDeletingArtifact: boolean;
  onOpenIssue: (issueId: string) => void;
  onUploadArtifact: React.FormEventHandler<HTMLFormElement>;
  onDeleteArtifact: (artifactId: string) => void;
}) {
  return (
    <Card className="min-w-0 overflow-hidden" data-testid="release-detail-card">
      {!selectedReleaseVersion || !releaseDetail ? (
        <CardContent className="flex min-h-[300px] items-center p-6">
          <div className="grid w-full gap-5 rounded-xl border border-dashed border-border bg-muted/10 p-6 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-background">
              <CircleDot className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                {selectedReleaseVersion
                  ? "Loading release details"
                  : "Release intelligence starts here"}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {selectedReleaseVersion
                  ? "Fetching affected issues, artifacts, and release activity."
                  : releases.length === 0
                    ? "Create a release to upload source maps before your next deploy."
                    : "Select a release to inspect affected issues and upload artifacts."}
              </p>
            </div>
          </div>
        </CardContent>
      ) : (
        <>
          <CardHeader className="min-w-0">
            <CardTitle className="break-all">{releaseDetail.release.version}</CardTitle>
            <CardDescription>
              {releaseDetail.release.eventCount} events · first seen{" "}
              {compactDate(releaseDetail.release.firstSeenAt)} · last seen{" "}
              {compactDate(releaseDetail.release.lastSeenAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <section>
              <div className="flex items-center gap-2 pb-2">
                <PackageOpen className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">
                  Affected issues
                  <span className="ml-2 text-muted-foreground">{releaseDetail.issues.length}</span>
                </h3>
              </div>
              {releaseDetail.issues.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No issues linked to this release yet.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border">
                  {releaseDetail.issues.map((issue: IssueDto, index: number) => (
                    <button
                      className={
                        index > 0
                          ? "flex w-full items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                          : "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
                      }
                      key={issue.id}
                      onClick={() => onOpenIssue(issue.id)}
                      type="button"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{issue.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {issue.level} · {issue.timesSeen} events
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {issue.status}
                        <ArrowUpRight className="size-3.5" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="flex items-center gap-2 pb-2">
                <Boxes className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">
                  Artifacts
                  <span className="ml-2 text-muted-foreground">{artifacts.length}</span>
                </h3>
              </div>
              <form className="flex flex-wrap items-center gap-3" onSubmit={onUploadArtifact}>
                <input
                  accept=".js,.map,.mjs,.cjs,.txt,.json"
                  aria-label="Artifact file"
                  className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium focus-visible:border-ring"
                  name="file"
                  required
                  type="file"
                />
                <Button disabled={isUploadingArtifact} size="sm" type="submit" variant="secondary">
                  <UploadCloud className="size-4" />
                  Upload
                </Button>
              </form>
              {uploadError ? (
                <Alert className="mt-2" variant="destructive">
                  <AlertDescription>{uploadError}</AlertDescription>
                </Alert>
              ) : null}

              {artifacts.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No artifacts yet. Upload source maps, ProGuard mappings, or Dart obfuscation maps
                  to restore readable stack traces.
                </p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-lg border border-border">
                  {artifacts.map((artifact, index) => (
                    <div
                      className={
                        index > 0
                          ? "flex items-center justify-between gap-3 border-t border-border px-4 py-2.5"
                          : "flex items-center justify-between gap-3 px-4 py-2.5"
                      }
                      key={artifact.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{artifact.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(artifact.size)} ·{" "}
                          {renderNullableText(artifact.contentType, "n/a")} ·{" "}
                          {compactDate(artifact.createdAt)}
                        </p>
                      </div>
                      <Button
                        disabled={isDeletingArtifact}
                        onClick={() => onDeleteArtifact(artifact.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Delete
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </>
      )}
    </Card>
  );
}

export { ReleaseDetailCard };
