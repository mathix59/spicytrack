import { BellRing, Plus } from "lucide-react";

import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";

import { AlertRuleCreateDialog } from "./alert-rule-create-dialog";
import { AlertRuleItem } from "./alert-rule-item";
import { SigningSecretDialog } from "./signing-secret-dialog";
import type { ProjectAlertsPanelData } from "./types";

function ProjectAlertRulesCard({ state }: { state: ProjectAlertsPanelData }) {
  const { rules, rulesQuery } = state;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex items-center gap-3">
              <CardTitle>Alert rules</CardTitle>
              {rulesQuery.isLoading ? null : <Badge variant="muted">{rules.length}</Badge>}
            </div>
            <CardDescription>Decide which events notify whom, and where.</CardDescription>
          </div>
          <AlertRuleCreateDialog
            destinationType={state.createDestinationType}
            error={state.createError}
            isPending={state.isCreating}
            onDestinationTypeChange={state.setCreateDestinationType}
            onOpenChange={state.setCreateOpen}
            onSubmit={state.createRule}
            open={state.createOpen}
            trigger={
              <Button size="sm" type="button">
                <Plus />
                New rule
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-3 sm:p-4">
        {rulesQuery.isLoading ? (
          <SkeletonRows className="[&>*]:h-28" rows={2} />
        ) : rulesQuery.error ? (
          <QueryError
            error={rulesQuery.error}
            onRetry={rulesQuery.retry}
            title="Could not load alert rules"
          />
        ) : rules.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={() => state.setCreateOpen(true)} size="sm" type="button">
                <Plus />
                Create alert rule
              </Button>
            }
            description="Notify a webhook, email, Slack, Teams, Discord or PagerDuty destination on new issues, regressions or event thresholds."
            icon={BellRing}
            title="No alert rules yet"
          />
        ) : (
          rules.map((rule) => (
            <AlertRuleItem
              isSaving={state.savingRuleId === rule.id}
              isTesting={state.testingRuleId === rule.id}
              key={rule.id}
              onDelete={() => state.removeRule(rule.id)}
              onSubmit={(event) => state.updateRule(event, rule)}
              onRotateSecret={() => state.rotateSigningSecret(rule.id)}
              onTest={() => void state.testRule(rule.id)}
              rule={rule}
            />
          ))
        )}
      </CardContent>
      <SigningSecretDialog onClose={state.dismissRevealedSecret} revealed={state.revealedSecret} />
    </Card>
  );
}

export { ProjectAlertRulesCard };
