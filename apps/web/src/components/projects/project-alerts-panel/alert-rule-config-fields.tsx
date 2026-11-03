import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { DestinationTypeSelect } from "./destination-type-select";
import type { DestinationType } from "./types";
import {
  destinationTargetHint,
  destinationTargetInputType,
  destinationTargetLabel,
  destinationTargetPlaceholder,
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

/**
 * Trigger, threshold, cooldown and destination fields shared by the create and edit forms.
 * `current` is the saved destination when editing: secret URLs come back masked, so the field
 * stays blank and an empty value keeps the saved URL.
 */
function AlertRuleConfigFields({
  triggerTypes,
  threshold,
  thresholdWindowMinutes = 60,
  cooldownMinutes,
  destinationType,
  current,
  onDestinationTypeChange,
}: {
  triggerTypes: string[];
  threshold?: number | null;
  thresholdWindowMinutes?: number;
  cooldownMinutes: number;
  destinationType: DestinationType;
  current?: { destinationType: string; destinationTarget: string };
  onDestinationTypeChange: (value: DestinationType) => void;
}) {
  const keepsSecret = current?.destinationType === destinationType && destinationType !== "email";
  const defaultTarget =
    current?.destinationType === destinationType && destinationType === "email"
      ? current.destinationTarget
      : undefined;

  return (
    <>
      <Field label="Triggers">
        <TriggerCheckboxes defaultValues={triggerTypes} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field hint="Events needed by the threshold trigger." label="Threshold">
          <Input
            defaultValue={threshold ?? ""}
            max="1000000"
            min="1"
            name="threshold"
            placeholder="100"
            type="number"
          />
        </Field>
        <Field hint="Window the threshold counts over." label="Window (min)">
          <Input
            defaultValue={thresholdWindowMinutes}
            max="10080"
            min="1"
            name="thresholdWindowMinutes"
            type="number"
          />
        </Field>
        <Field hint="Delay before the same issue alerts again." label="Cooldown (min)">
          <Input
            defaultValue={cooldownMinutes}
            max="10080"
            min="1"
            name="cooldownMinutes"
            type="number"
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Destination">
          <DestinationTypeSelect
            defaultValue={destinationType}
            name="destinationType"
            onChange={onDestinationTypeChange}
          />
        </Field>
        <Field
          hint={
            keepsSecret
              ? `Leave blank to keep the current ${destinationType === "pagerduty" ? "key" : "URL"}.`
              : destinationTargetHint(destinationType)
          }
          label={destinationTargetLabel(destinationType)}
        >
          <Input
            defaultValue={defaultTarget}
            key={destinationType}
            name="destinationTarget"
            placeholder={
              keepsSecret
                ? current?.destinationTarget
                : destinationTargetPlaceholder(destinationType)
            }
            autoComplete="off"
            required={!keepsSecret}
            type={destinationTargetInputType(destinationType)}
          />
        </Field>
      </div>
    </>
  );
}

export { AlertRuleConfigFields };
