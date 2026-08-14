import { useState } from "react";
import type { FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListProjectReleasesQueryKey,
  getListReleaseArtifactsQueryKey,
  useDeleteReleaseArtifact,
  useGetProjectRelease,
  useListReleaseArtifacts,
  useUploadReleaseArtifact,
  useUpsertProjectRelease,
  type ReleaseArtifactDto,
} from "@/generated/api";
import { runAsyncFormAction } from "@/lib/form-submission";
import { invalidateQueryKeys } from "@/lib/query-utils";

import type { ProjectReleasePanelData, ProjectReleasePanelProps } from "./types";

const EMPTY_ARTIFACTS: ReleaseArtifactDto[] = [];

function useProjectReleasePanel({
  orgSlug,
  projectSlug,
  selectedReleaseVersion,
  onSelectRelease,
}: Pick<
  ProjectReleasePanelProps,
  "orgSlug" | "projectSlug" | "selectedReleaseVersion" | "onSelectRelease"
>): ProjectReleasePanelData {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const releaseDetailQuery = useGetProjectRelease(orgSlug, projectSlug, selectedReleaseVersion, {
    query: {
      enabled: selectedReleaseVersion.length > 0,
    },
  });
  const artifactsQuery = useListReleaseArtifacts(orgSlug, projectSlug, selectedReleaseVersion, {
    query: {
      enabled: selectedReleaseVersion.length > 0,
    },
  });

  const invalidateArtifacts = async () => {
    await invalidateQueryKeys(queryClient, [
      getListReleaseArtifactsQueryKey(orgSlug, projectSlug, selectedReleaseVersion),
    ]);
  };

  const upsertReleaseMutation = useUpsertProjectRelease({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getListProjectReleasesQueryKey(orgSlug, projectSlug),
        ]);
      },
    },
  });
  const uploadArtifactMutation = useUploadReleaseArtifact({
    mutation: { onSuccess: invalidateArtifacts },
  });
  const deleteArtifactMutation = useDeleteReleaseArtifact({
    mutation: { onSuccess: invalidateArtifacts },
  });

  const releaseDetail = releaseDetailQuery.data?.data;
  const artifacts = artifactsQuery.data?.data ?? EMPTY_ARTIFACTS;

  const createRelease = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const version = String(formData.get("version") ?? "").trim();

    if (!version) {
      return;
    }

    await runAsyncFormAction({
      setError: setCreateError,
      action: () =>
        upsertReleaseMutation.mutateAsync({
          orgSlug,
          projectSlug,
          releaseVersion: version,
        }),
      onSuccess: async () => {
        onSelectRelease(version);
        setCreateOpen(false);
      },
    });
  };

  const uploadArtifact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      setUploadError("Choose a file to upload");
      return;
    }

    await runAsyncFormAction({
      setError: setUploadError,
      action: () =>
        uploadArtifactMutation.mutateAsync({
          orgSlug,
          projectSlug,
          releaseVersion: selectedReleaseVersion,
          data: { file },
        }),
      onSuccess: async () => {
        event.currentTarget.reset();
      },
    });
  };

  const deleteArtifact = async (artifactId: string) => {
    try {
      await deleteArtifactMutation.mutateAsync({
        orgSlug,
        projectSlug,
        releaseVersion: selectedReleaseVersion,
        artifactId,
      });
    } catch {
      // deletion failures surface via mutation state
    }
  };

  return {
    createOpen,
    createError,
    uploadError,
    releaseDetail,
    artifacts,
    isCreatingRelease: upsertReleaseMutation.isPending,
    isUploadingArtifact: uploadArtifactMutation.isPending,
    isDeletingArtifact: deleteArtifactMutation.isPending,
    setCreateOpen,
    createRelease,
    uploadArtifact,
    deleteArtifact,
  };
}

export { useProjectReleasePanel };
