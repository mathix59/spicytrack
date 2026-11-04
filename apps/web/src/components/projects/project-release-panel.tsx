import { ReleaseDetailCard } from "./project-release-panel/release-detail-card";
import { ReleaseListCard } from "./project-release-panel/release-list-card";
import type { ProjectReleasePanelProps } from "./project-release-panel/types";
import { useProjectReleasePanel } from "./project-release-panel/use-project-release-panel";

function ProjectReleasePanel(props: ProjectReleasePanelProps) {
  const state = useProjectReleasePanel(props);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ReleaseListCard
        createError={state.createError}
        createOpen={state.createOpen}
        error={props.releasesError}
        healthByVersion={state.healthByVersion}
        isCreatingRelease={state.isCreatingRelease}
        isLoading={props.releasesLoading}
        onCreateOpenChange={state.setCreateOpen}
        onCreateRelease={(event) => void state.createRelease(event)}
        onRetry={props.retryReleases}
        onSelectRelease={props.onSelectRelease}
        releases={props.releases}
        selectedReleaseVersion={props.selectedReleaseVersion}
      />
      <ReleaseDetailCard
        artifacts={state.artifacts}
        artifactsError={state.artifactsError}
        artifactsLoading={state.artifactsLoading}
        error={state.releaseDetailError}
        hasReleases={props.releases.length > 0}
        healthEnvironments={state.healthEnvironments}
        isLoading={props.releasesLoading || state.releaseDetailLoading}
        isUploadingArtifact={state.isUploadingArtifact}
        onDeleteArtifact={state.deleteArtifact}
        onOpenIssue={props.onOpenIssue}
        onRetry={state.retryReleaseDetail}
        onRetryArtifacts={state.retryArtifacts}
        onUploadArtifact={(event) => void state.uploadArtifact(event)}
        orgSlug={props.orgSlug}
        projectSlug={props.projectSlug}
        releaseDetail={state.releaseDetail}
        selectedReleaseVersion={props.selectedReleaseVersion}
        uploadError={state.uploadError}
      />
    </div>
  );
}

export { ProjectReleasePanel };
