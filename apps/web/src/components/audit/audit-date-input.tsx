import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Date filter that reads "Any date" while empty. Safari and Chrome otherwise grey out today's
 * date or a dd/mm/yyyy mask, which looks like a filter that is already applied. Firefox styles
 * its own mm/dd/yyyy mask as a placeholder already, and that mask ignores the text colour, so
 * the overlay stays out of its way there.
 */
function AuditDateInput({
  value,
  onChange,
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "onChange" | "type" | "value"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  const empty = value === "";
  return (
    <div className="relative">
      <Input
        {...props}
        className={cn(
          "peer",
          empty && "not-supports-[-moz-orient:inline]:[&:not(:focus)]:text-transparent",
          className,
        )}
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
      {empty ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground peer-focus:hidden supports-[-moz-orient:inline]:hidden"
        >
          Any date
        </span>
      ) : null}
    </div>
  );
}

export { AuditDateInput };
