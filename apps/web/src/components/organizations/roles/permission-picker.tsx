import { useState } from "react";

import { cn } from "@/lib/utils";

import type { PermissionGroup } from "./permission-groups";

/**
 * Grouped permission checkboxes with a "select all" toggle per group. Checked values are
 * submitted as repeated `name` form fields, so callers keep reading them with FormData.
 */
function PermissionPicker({
  groups,
  defaultSelected = [],
  name = "permissions",
  legend = "Permissions",
  showKeys = false,
}: {
  groups: PermissionGroup[];
  defaultSelected?: string[];
  name?: string;
  legend?: string;
  showKeys?: boolean;
}) {
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const known = new Set(groups.flatMap((group) => group.permissions.map((entry) => entry.value)));
  // Permissions the picker does not know about are preserved untouched on submit.
  const unknown = defaultSelected.filter((permission) => !known.has(permission));

  const toggle = (values: string[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const value of values) {
        if (checked) next.add(value);
        else next.delete(value);
      }
      return next;
    });
  };

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1.5 text-sm font-medium text-foreground">
        {legend}{" "}
        <span className="font-normal text-muted-foreground">({selected.size} selected)</span>
      </legend>
      {groups.map((group) => {
        const values = group.permissions.map((entry) => entry.value);
        const checkedCount = values.filter((value) => selected.has(value)).length;
        const allChecked = checkedCount === values.length;

        return (
          <div className="rounded-md border border-border" key={group.id}>
            <label className="flex cursor-pointer items-center gap-2 border-b border-border bg-muted/20 px-3 py-2 text-sm font-medium">
              <input
                aria-label={`Select all ${group.label} permissions`}
                checked={allChecked}
                onChange={(event) => toggle(values, event.target.checked)}
                ref={(element) => {
                  if (element) element.indeterminate = checkedCount > 0 && !allChecked;
                }}
                type="checkbox"
              />
              <span className="flex-1">{group.label}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {checkedCount}/{values.length}
              </span>
            </label>
            <div className="grid gap-1 p-2 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent/50",
                    selected.has(permission.value) && "text-foreground",
                  )}
                  key={permission.value}
                >
                  <input
                    checked={selected.has(permission.value)}
                    className="mt-0.5"
                    name={name}
                    onChange={(event) => toggle([permission.value], event.target.checked)}
                    type="checkbox"
                    value={permission.value}
                  />
                  <span className="grid min-w-0">
                    <span>{permission.label}</span>
                    {showKeys ? (
                      <code className="truncate text-[11px] text-muted-foreground">
                        {permission.value}
                      </code>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {unknown.map((permission) => (
        <input key={permission} name={name} type="hidden" value={permission} />
      ))}
    </fieldset>
  );
}

export { PermissionPicker };
