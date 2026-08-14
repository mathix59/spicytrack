import { Select } from "@/components/ui/select";

import { DESTINATION_TYPES } from "./utils";
import type { DestinationType } from "./types";

function DestinationTypeSelect({
  name,
  defaultValue,
  onChange,
  ...accessibilityProps
}: {
  name: string;
  defaultValue: DestinationType;
  onChange?: (value: DestinationType) => void;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  return (
    <Select
      {...accessibilityProps}
      defaultValue={defaultValue}
      name={name}
      onChange={(event) => onChange?.(event.target.value as DestinationType)}
    >
      {DESTINATION_TYPES.map((type) => (
        <option key={type} value={type}>
          {type}
        </option>
      ))}
    </Select>
  );
}

export { DestinationTypeSelect };
