import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getListOrganizationInvitationsQueryKey,
  getListOrganizationMembersQueryKey,
  getListProjectsQueryKey,
  getListTeamsQueryKey,
  useCreateOrganizationInvitation,
  useCreateProject,
  useCreateTeam,
  useResendOrganizationInvitation,
} from "@/generated/api";
import { runAsyncFormAction } from "@/lib/form-submission";
import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { slugify } from "@/lib/slug";
import { getErrorMessage } from "@/lib/utils";

/** Dialog state, create/invite mutations and their form handlers for the organization page. */
function useOrganizationPageActions(orgSlug: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const createInvitationMutation = useCreateOrganizationInvitation({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [
          getListOrganizationMembersQueryKey(orgSlug),
          getListOrganizationInvitationsQueryKey(orgSlug),
        ]);
      },
    },
  });
  const resendInvitationMutation = useResendOrganizationInvitation({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListOrganizationInvitationsQueryKey(orgSlug)]);
        toast.success("Invitation resent");
      },
      onError: (error) => {
        toast.error(`Could not resend the invitation: ${getErrorMessage(error)}`);
      },
    },
  });
  const createTeamMutation = useCreateTeam({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListTeamsQueryKey(orgSlug)]);
      },
    },
  });
  const createProjectMutation = useCreateProject({
    mutation: {
      onSuccess: async () => {
        await invalidateQueryKeys(queryClient, [getListProjectsQueryKey(orgSlug)]);
      },
    },
  });

  const inviteMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setInviteError,
      action: () =>
        createInvitationMutation.mutateAsync({
          orgSlug,
          data: {
            email: String(formData.get("email") ?? ""),
            role: String(formData.get("role") ?? "member"),
          },
        }),
      onSuccess: async () => {
        setInviteOpen(false);
        toast.success("Invitation sent");
      },
    });
  };

  const createTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("name") ?? "");
    await runAsyncFormAction({
      setError: setTeamError,
      action: () =>
        createTeamMutation.mutateAsync({
          orgSlug,
          data: {
            name,
            slug: slugify(name),
            description: String(formData.get("description") ?? "").trim() || undefined,
          },
        }),
      onSuccess: async () => {
        setTeamOpen(false);
        toast.success("Team created");
      },
    });
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    await runAsyncFormAction({
      setError: setProjectError,
      action: () =>
        createProjectMutation.mutateAsync({
          orgSlug,
          data: {
            name: String(formData.get("name") ?? ""),
            platform: String(
              formData.get("platform") ?? PLATFORM_OPTIONS[0]?.value ?? "javascript",
            ),
            visibility: String(formData.get("visibility") ?? "private"),
            teamId: (String(formData.get("teamId") ?? "") || undefined) as never,
          },
        }),
      onSuccess: async (response) => {
        setProjectOpen(false);
        toast.success("Project created");
        // New projects start in the setup wizard, until their first event arrives.
        navigate(`/orgs/${orgSlug}/projects/${response.data.slug}?tab=setup`);
      },
    });
  };

  return {
    projects: {
      projectOpen,
      projectError,
      createProject,
      setProjectOpen,
      isCreatingProject: createProjectMutation.isPending,
    },
    members: {
      inviteOpen,
      inviteError,
      inviteMember,
      resendInvitation: (invitationId: string) =>
        resendInvitationMutation.mutate({ orgSlug, invitationId }),
      setInviteOpen,
      isInvitingMember: createInvitationMutation.isPending,
      isResendingInvitation: resendInvitationMutation.isPending,
    },
    teams: {
      teamOpen,
      teamError,
      createTeam,
      setTeamOpen,
      isCreatingTeam: createTeamMutation.isPending,
    },
  };
}

export { useOrganizationPageActions };
