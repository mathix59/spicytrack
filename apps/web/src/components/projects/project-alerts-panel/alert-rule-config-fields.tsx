import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { DestinationTypeSelect } from "./destination-type-select";
import type { DestinationType } from "./types";
import {
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

/** Trigger, threshold, cooldown and destination fields shared by the create and edit forms. */
function AlertRuleConfigFields({
  triggerTypes,
  threshold,
  cooldownMinutes,
  destinationType,
  destinationTarget,
  onDestinationTypeChange,
}: {
  triggerTypes: string[];
  threshold?: number | null;
  cooldownMinutes: number;
  destinationType: DestinationType;
  destinationTarget?: string;
  onDestinationTypeChange: (value: DestinationType) => void;
}) {
  return (
    <>
      <Field label="Triggers">
        <TriggerCheckboxes defaultValues={triggerTypes} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field hint="Used by the event threshold trigger." label="Threshold">
          <Input
            defaultValue={threshold ?? ""}
            min="1"
            name="threshold"
            placeholder="100"
            type="number"
          />
        </Field>
        <Field hint="Minimum delay between two alerts." label="Cooldown (min)">
          <Input defaultValue={cooldownMinutes} min="1" name="cooldownMinutes" type="number" />
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
        <Field label={destinationTargetLabel(destinationType)}>
          <Input
            defaultValue={destinationTarget}
            key={destinationTarget === undefined ? destinationType : undefined}
            name="destinationTarget"
            placeholder={destinationTargetPlaceholder(destinationType)}
            required
            type={destinationTargetInputType(destinationType)}
          />
        </Field>
      </div>
    </>
  );
}

export { AlertRuleConfigFields };
