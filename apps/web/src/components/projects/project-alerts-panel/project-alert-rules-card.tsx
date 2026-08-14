import { useState } from "react";
import type { FormEvent } from "react";

import type { AlertRuleDto } from "@/generated/api";
import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import type { DestinationType, TriggerType } from "./types";
import { DestinationTypeSelect } from "./destination-type-select";
import {
  BellRing,
  destinationIcon,
  destinationTargetInputType,
  destinationTargetLabel,
  destinationTargetPlaceholder,
  triggerLabel,
  TRIGGER_TYPES,
} from "./utils";

function TriggerCheckboxes({ defaultValues }: { defaultValues: string[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Triggers">
      {TRIGGER_TYPES.map((trigger) => (
        <label
          className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
          key={trigger.value}
        >
          <input
            defaultChecked={defaultValues.includes(trigger.value)}
            name="triggerTypes"
            type="checkbox"
            value={trigger.value}
          />
          {trigger.label}
        </label>
      ))}
    </div>
  );
}

function ruleTriggerTypes(rule: AlertRuleDto): TriggerType[] {
  const values = rule.triggerTypes?.length ? rule.triggerTypes : [rule.triggerType ?? "new_issue"];
  return values.filter((value): value is TriggerType =>
    TRIGGER_TYPES.some((trigger) => trigger.value === value),
  );
}

function ProjectAlertRulesCard({
  rules,
  error,
  createOpen,
  createDestinationType,
  isCreating,
  isUpdating,
  isDeleting,
  testingRuleId,
  onCreateOpenChange,
  onCreateDestinationTypeChange,
  onCreateRule,
  onUpdateRule,
  onRemoveRule,
  onTestRule,
}: {
  rules: AlertRuleDto[];
  error: string | null;
  createOpen: boolean;
  createDestinationType: DestinationType;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  testingRuleId: string | null;
  onCreateOpenChange: (open: boolean) => void;
  onCreateDestinationTypeChange: (value: DestinationType) => void;
  onCreateRule: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateRule: (event: FormEvent<HTMLFormElement>, rule: AlertRuleDto) => Promise<void>;
  onRemoveRule: (ruleId: string) => Promise<void>;
  onTestRule: (ruleId: string) => Promise<void>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle>Alert rules</CardTitle>
            <Badge variant="muted">{rules.length}</Badge>
          </div>
          <Dialog onOpenChange={onCreateOpenChange} open={createOpen}>
            <DialogTrigger asChild>
              <Button size="sm">New rule</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New alert rule</DialogTitle>
                <DialogDescription>
                  React to new issues or event thresholds by notifying a destination.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4" onSubmit={(event) => void onCreateRule(event)}>
                <Field label="Name">
                  <Input name="name" required />
                </Field>
                <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
                  <Field label="Triggers">
                    <TriggerCheckboxes defaultValues={["new_issue"]} />
                  </Field>
                  <Field label="Threshold">
                    <Input min="1" name="threshold" placeholder="100" type="number" />
                  </Field>
                  <Field label="Cooldown (min)">
                    <Input defaultValue="30" min="1" name="cooldownMinutes" type="number" />
                  </Field>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Destination">
                    <DestinationTypeSelect
                      defaultValue={createDestinationType}
                      name="destinationType"
                      onChange={onCreateDestinationTypeChange}
                    />
                  </Field>
                  <Field label={destinationTargetLabel(createDestinationType)}>
                    <Input
                      key={createDestinationType}
                      name="destinationTarget"
                      placeholder={destinationTargetPlaceholder(createDestinationType)}
                      required
                      type={destinationTargetInputType(createDestinationType)}
                    />
                  </Field>
                </div>
                {error ? (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <FormDialogActions isPending={isCreating} submitLabel="Create rule" />
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 p-3">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {rules.length === 0 ? (
          <EmptyState
            title="No rules yet"
            description="Set up project webhooks to react to new issues or event thresholds."
          />
        ) : (
          rules.map((rule) => (
            <AlertRuleForm
              isDeleting={isDeleting}
              isSaving={isUpdating}
              isTesting={testingRuleId === rule.id}
              key={rule.id}
              onDelete={() => void onRemoveRule(rule.id)}
              onSubmit={(event) => void onUpdateRule(event, rule)}
              onTest={() => void onTestRule(rule.id)}
              rule={rule}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function AlertRuleForm({
  rule,
  onSubmit,
  onDelete,
  isSaving,
  isDeleting,
  isTesting,
  onTest,
}: {
  rule: AlertRuleDto;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  isTesting: boolean;
  onTest: () => void;
}) {
  const [destinationType, setDestinationType] = useState<DestinationType>(
    (rule.destinationType as DestinationType) ?? "webhook",
  );
  const [isActive, setIsActive] = useState(rule.isActive);
  const Icon = destinationIcon(destinationType);

  return (
    <form
      className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" />
          <p className="truncate text-sm font-medium">{rule.name}</p>
        </div>
        <Badge variant={rule.isActive ? "accent" : "muted"}>
          {rule.isActive ? "active" : "paused"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {ruleTriggerTypes(rule).map((triggerType) => (
          <Badge key={triggerType} variant="muted">
            {triggerLabel(triggerType, rule.threshold)}
          </Badge>
        ))}
        <Badge variant="muted">{rule.destinationType}</Badge>
        <Badge variant="muted">{rule.cooldownMinutes}m cooldown</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <Input defaultValue={rule.name} name="name" required />
        </Field>
        <Field label="Status">
          <div className="flex h-9 items-center gap-2">
            <input name="isActive" type="hidden" value={String(isActive)} />
            <Switch
              aria-label="Alert rule status"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <span className="text-sm text-muted-foreground">{isActive ? "Active" : "Paused"}</span>
          </div>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <Field label="Triggers">
          <TriggerCheckboxes defaultValues={ruleTriggerTypes(rule)} />
        </Field>
        <Field label="Threshold">
          <Input
            defaultValue={rule.threshold ?? ""}
            min="1"
            name="threshold"
            placeholder="100"
            type="number"
          />
        </Field>
        <Field label="Cooldown (min)">
          <Input defaultValue={rule.cooldownMinutes} min="1" name="cooldownMinutes" type="number" />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Destination">
          <DestinationTypeSelect
            defaultValue={destinationType}
            name="destinationType"
            onChange={setDestinationType}
          />
        </Field>
        <Field label={destinationTargetLabel(destinationType)}>
          <Input
            defaultValue={rule.destinationTarget}
            name="destinationTarget"
            placeholder={destinationTargetPlaceholder(destinationType)}
            required
            type={destinationTargetInputType(destinationType)}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-border bg-background/80 p-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          {rule.destinationType}
        </div>
        <p className="mt-1 break-all font-mono text-[11px] text-foreground">
          {rule.destinationTarget}
        </p>
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button disabled={isDeleting} onClick={onDelete} type="button" variant="ghost">
          Delete rule
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isTesting} onClick={onTest} type="button" variant="outline">
            {isTesting ? "Testing…" : "Test"}
          </Button>
          <Button disabled={isSaving} type="submit">
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

export { ProjectAlertRulesCard };
