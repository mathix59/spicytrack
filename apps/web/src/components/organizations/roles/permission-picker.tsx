import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PermissionGroup, PermissionOption } from "./permission-groups";

function PermissionChange({ granted }: { granted: boolean }) {
  return granted ? (
    <span className="text-2xs font-medium text-success">Added</span>
  ) : (
    <span className="text-2xs font-medium text-destructive">Removed</span>
  );
}

function SensitiveMark() {
  return (
    <span
      className="inline-flex items-center gap-1 text-2xs font-medium text-warning"
      title="Grants control over people, credentials or the organization"
    >
      <ShieldAlert aria-hidden className="size-3" />
      Sensitive
    </span>
  );
}

function PermissionRow({
  permission,
  checked,
  changed,
  showKey,
  onToggle,
}: {
  permission: PermissionOption;
  checked: boolean;
  changed: boolean;
  showKey: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 transition-colors hover:bg-accent/50",
        changed && "bg-accent/40",
      )}
    >
      <input
        checked={checked}
        className="mt-0.5"
        onChange={(event) => onToggle(event.target.checked)}
        type="checkbox"
        value={permission.value}
      />
      <span className="grid min-w-0 gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className={cn(checked ? "text-foreground" : "text-muted-foreground")}>
            {permission.label}
          </span>
          {permission.sensitive ? <SensitiveMark /> : null}
          {changed ? <PermissionChange granted={checked} /> : null}
        </span>
        <span className="text-xs text-muted-foreground">{permission.description}</span>
        {showKey ? (
          <code className="truncate text-2xs text-subtle-foreground">{permission.value}</code>
        ) : null}
      </span>
    </label>
  );
}

/**
 * Grouped permission checkboxes with a "select all" toggle per group. When a baseline is given
 * (the role being edited, or the role it starts from) every difference is marked.
 */
function PermissionPicker({
  groups,
  selected,
  onChange,
  baseline,
  legend = "Permissions",
  showKeys = false,
}: {
  groups: PermissionGroup[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  baseline?: Set<string>;
  legend?: string;
  showKeys?: boolean;
}) {
  const known = groups.flatMap((group) => group.permissions.map((entry) => entry.value));
  const selectedCount = known.filter((value) => selected.has(value)).length;

  const toggle = (values: string[], checked: boolean) => {
    const next = new Set(selected);
    for (const value of values) {
      if (checked) next.add(value);
      else next.delete(value);
    }
    onChange(next);
  };

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1.5 text-sm font-medium text-foreground">
        {legend}{" "}
        <span className="font-normal text-muted-foreground">
          ({selectedCount} of {known.length})
        </span>
      </legend>
      {groups.map((group) => {
        const values = group.permissions.map((entry) => entry.value);
        const checkedCount = values.filter((value) => selected.has(value)).length;
        const allChecked = checkedCount === values.length;

        return (
          <div className="rounded-lg border border-border" key={group.id}>
            <label className="flex cursor-pointer items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-sm font-medium">
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
              <span className="text-xs font-normal text-muted-foreground tabular">
                {checkedCount}/{values.length}
              </span>
            </label>
            <div className="grid gap-0.5 p-1.5 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <PermissionRow
                  changed={
                    baseline !== undefined &&
                    baseline.has(permission.value) !== selected.has(permission.value)
                  }
                  checked={selected.has(permission.value)}
                  key={permission.value}
                  onToggle={(checked) => toggle([permission.value], checked)}
                  permission={permission}
                  showKey={showKeys}
                />
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export { PermissionPicker, SensitiveMark };
