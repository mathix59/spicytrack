import { ProjectAlertDeliveriesCard } from "./project-alerts-panel/project-alert-deliveries-card";
import { ProjectAlertRulesCard } from "./project-alerts-panel/project-alert-rules-card";
import type { ProjectAlertsPanelProps } from "./project-alerts-panel/types";
import { useProjectAlertsPanel } from "./project-alerts-panel/use-project-alerts-panel";

function ProjectAlertsPanel(props: ProjectAlertsPanelProps) {
  const state = useProjectAlertsPanel(props);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <ProjectAlertRulesCard
        createDestinationType={state.createDestinationType}
        createOpen={state.createOpen}
        error={state.error}
        isCreating={state.isCreating}
        isDeleting={state.isDeleting}
        isUpdating={state.isUpdating}
        onCreateDestinationTypeChange={state.setCreateDestinationType}
        onCreateOpenChange={state.setCreateOpen}
        onCreateRule={state.createRule}
        onRemoveRule={state.removeRule}
        onUpdateRule={state.updateRule}
        rules={state.rules}
      />
      <ProjectAlertDeliveriesCard deliveries={state.deliveries} />
    </div>
  );
}

export { ProjectAlertsPanel };
