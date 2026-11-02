import { ProjectAlertDeliveriesCard } from "./project-alerts-panel/project-alert-deliveries-card";
import { ProjectAlertRulesCard } from "./project-alerts-panel/project-alert-rules-card";
import type { ProjectAlertsPanelProps } from "./project-alerts-panel/types";
import { useProjectAlertsPanel } from "./project-alerts-panel/use-project-alerts-panel";

function ProjectAlertsPanel(props: ProjectAlertsPanelProps) {
  const state = useProjectAlertsPanel(props);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <ProjectAlertRulesCard state={state} />
      <ProjectAlertDeliveriesCard state={state} />
    </div>
  );
}

export { ProjectAlertsPanel };
