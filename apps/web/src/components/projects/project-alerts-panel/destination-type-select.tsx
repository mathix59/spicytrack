import { Select } from "@/components/ui/select";

import { DESTINATION_TYPES } from "./utils";
import type { DestinationType } from "./types";

function DestinationTypeSelect({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue: DestinationType;
  onChange?: (value: DestinationType) => void;
}) {
  return (
    <Select
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
