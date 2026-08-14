import { ProjectKeyListCard } from "./project-keys-tab/project-key-list-card";
import { ProjectKeySetupCard } from "./project-keys-tab/project-key-setup-card";
import type { ProjectKeysTabProps } from "./project-keys-tab/types";
import { useProjectKeysTab } from "./project-keys-tab/use-project-keys-tab";

function ProjectKeysTab(props: ProjectKeysTabProps) {
  const state = useProjectKeysTab(props);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <ProjectKeySetupCard
        dsn={state.primaryKey?.dsn}
        effectivePlatform={state.effectivePlatform}
        onPlatformChange={state.setSelectedPlatform}
      />
      <ProjectKeyListCard
        createOpen={state.createOpen}
        error={state.error}
        isCreating={state.isCreating}
        isRotating={state.isRotating}
        isUpdating={state.isUpdating}
        keys={state.keys}
        managedKey={state.managedKey}
        onCreateKey={state.createKey}
        onCreateOpenChange={state.setCreateOpen}
        onManagedKeyChange={state.setManagedKey}
        onResetError={state.resetError}
        onRotateKey={state.rotateKey}
        onSaveKey={state.saveKey}
        onToggleKey={state.updateKey}
        primaryKeyId={state.primaryKey?.id}
      />
    </div>
  );
}

export { ProjectKeysTab };
