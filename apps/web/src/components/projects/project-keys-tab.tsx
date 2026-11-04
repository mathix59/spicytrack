import { useGetProject } from "@/generated/api";

import { ProjectKeyListCard } from "./project-keys-tab/project-key-list-card";
import {
  ProjectKeySetupCard,
  ProjectKeySetupSection,
} from "./project-keys-tab/project-key-setup-card";
import type { ProjectKeysTabProps } from "./project-keys-tab/types";
import { useProjectKeysTab } from "./project-keys-tab/use-project-keys-tab";

function ProjectKeysTab(props: ProjectKeysTabProps) {
  const state = useProjectKeysTab(props);
  // Shares the project page's cache entry, so a project with events opens on its keys at once.
  const projectQuery = useGetProject(props.orgSlug, props.projectSlug);
  const dsn = state.primaryKey?.dsn;
  const hasEvents =
    state.firstEvent.state === "received" || Boolean(projectQuery.data?.data.firstEventAt);

  // Once events arrive, keys are what people come here for; the guide stays one click away.
  if (hasEvents && (dsn || state.isLoading)) {
    return (
      <div className="grid gap-6">
        <ProjectKeyListCard state={state} />
        {dsn ? (
          <ProjectKeySetupSection
            dsn={dsn}
            effectivePlatform={state.effectivePlatform}
            firstEvent={state.firstEvent}
            onPlatformChange={state.setSelectedPlatform}
            orgSlug={props.orgSlug}
            projectSlug={props.projectSlug}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <ProjectKeySetupCard
        dsn={dsn}
        effectivePlatform={state.effectivePlatform}
        firstEvent={state.firstEvent}
        isLoading={state.isLoading}
        loadFailed={Boolean(state.loadError)}
        onCreateKey={() => state.setCreateOpen(true)}
        onPlatformChange={state.setSelectedPlatform}
        orgSlug={props.orgSlug}
        projectSlug={props.projectSlug}
      />
      <ProjectKeyListCard state={state} />
    </div>
  );
}

export { ProjectKeysTab };
