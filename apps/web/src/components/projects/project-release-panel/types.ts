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
  releasesLoading: boolean;
  releasesError: unknown;
  retryReleases: () => void;
  selectedReleaseVersion: string;
  onSelectRelease: (releaseVersion: string) => void;
  onOpenIssue: (issueId: string) => void;
};

type ProjectReleasePanelData = {
  createOpen: boolean;
  createError: string | null;
  uploadError: string | null;
  releaseDetail: ProjectReleaseDetailDto | undefined;
  releaseDetailLoading: boolean;
  releaseDetailError: unknown;
  retryReleaseDetail: () => void;
  artifacts: ReleaseArtifactDto[];
  artifactsLoading: boolean;
  artifactsError: unknown;
  retryArtifacts: () => void;
  isCreatingRelease: boolean;
  isUploadingArtifact: boolean;
  setCreateOpen: (open: boolean) => void;
  createRelease: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  uploadArtifact: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Throws on failure so the confirmation dialog can show the error. */
  deleteArtifact: (artifactId: string) => Promise<void>;
};

export type { ProjectReleasePanelData, ProjectReleasePanelProps };
