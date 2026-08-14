import type { FormEvent } from "react";

import type {
  ProjectReleaseDetailDto,
  ProjectReleaseDto,
  ReleaseArtifactDto,
} from "@/generated/api";

type ProjectReleasePanelProps = {
  orgSlug: string;
  projectSlug: string;
  releases: ProjectReleaseDto[];
  selectedReleaseVersion: string;
  onSelectRelease: (releaseVersion: string) => void;
  onOpenIssue: (issueId: string) => void;
};

type ProjectReleasePanelData = {
  createOpen: boolean;
  createError: string | null;
  uploadError: string | null;
  releaseDetail: ProjectReleaseDetailDto | undefined;
  artifacts: ReleaseArtifactDto[];
  isCreatingRelease: boolean;
  isUploadingArtifact: boolean;
  isDeletingArtifact: boolean;
  setCreateOpen: (open: boolean) => void;
  createRelease: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  uploadArtifact: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
};

export type { ProjectReleasePanelData, ProjectReleasePanelProps };
