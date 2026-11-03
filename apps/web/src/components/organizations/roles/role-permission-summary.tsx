import { Check, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

import type { PermissionGroup } from "./permission-groups";
import { SensitiveMark } from "./permission-picker";

/** Every permission of the catalogue, with what the role grants highlighted. */
function RolePermissionSummary({
  groups,
  permissions,
}: {
  groups: PermissionGroup[];
  permissions: string[];
}) {
  const granted = new Set(permissions);
  const known = new Set(groups.flatMap((group) => group.permissions.map((entry) => entry.value)));
  const unknown = permissions.filter((permission) => !known.has(permission));

  return (
    <div className="grid gap-4">
      {groups.map((group) => {
        const count = group.permissions.filter((entry) => granted.has(entry.value)).length;
        return (
          <section aria-label={group.label} className="grid gap-1.5" key={group.id}>
            <h4 className="flex items-center justify-between text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {group.label}
              <span className="font-normal tracking-normal normal-case tabular">
                {count}/{group.permissions.length}
              </span>
            </h4>
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {group.permissions.map((permission) => {
                const has = granted.has(permission.value);
                return (
                  <li
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-1.5",
                      has && "bg-muted/50",
                    )}
                    key={permission.value}
                  >
                    {has ? (
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <Minus
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0 text-subtle-foreground"
                      />
                    )}
                    <span className="grid min-w-0 gap-0.5">
                      <span className="flex flex-wrap items-center gap-x-2 text-sm">
                        <span className={has ? "text-foreground" : "text-muted-foreground"}>
                          {permission.label}
                        </span>
                        <span className="sr-only">{has ? "(granted)" : "(not granted)"}</span>
                        {has && permission.sensitive ? <SensitiveMark /> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {permission.description}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {unknown.length > 0 ? (
        <section aria-label="Other permissions" className="grid gap-1.5">
          <h4 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Other
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {unknown.map((permission) => (
              <Badge key={permission} variant="muted">
                {permission}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export { RolePermissionSummary };
