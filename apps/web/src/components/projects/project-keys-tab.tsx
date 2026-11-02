import { ProjectKeyListCard } from "./project-keys-tab/project-key-list-card";
import { ProjectKeySetupCard } from "./project-keys-tab/project-key-setup-card";
import type { ProjectKeysTabProps } from "./project-keys-tab/types";
import { useProjectKeysTab } from "./project-keys-tab/use-project-keys-tab";

function ProjectKeysTab(props: ProjectKeysTabProps) {
  const state = useProjectKeysTab(props);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <ProjectKeySetupCard
        dsn={state.primaryKey?.dsn}
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
