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
        isCreatingRelease={state.isCreatingRelease}
        onCreateOpenChange={state.setCreateOpen}
        onCreateRelease={(event) => void state.createRelease(event)}
        onSelectRelease={props.onSelectRelease}
        releases={props.releases}
        selectedReleaseVersion={props.selectedReleaseVersion}
      />
      <ReleaseDetailCard
        artifacts={state.artifacts}
        isDeletingArtifact={state.isDeletingArtifact}
        isUploadingArtifact={state.isUploadingArtifact}
        onDeleteArtifact={(artifactId) => void state.deleteArtifact(artifactId)}
        onOpenIssue={props.onOpenIssue}
        onUploadArtifact={(event) => void state.uploadArtifact(event)}
        releaseDetail={state.releaseDetail}
        releases={props.releases}
        selectedReleaseVersion={props.selectedReleaseVersion}
        uploadError={state.uploadError}
      />
    </div>
  );
}

export { ProjectReleasePanel };
