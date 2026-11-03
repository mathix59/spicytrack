import { Fragment } from "react";
import { Check, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import type { PermissionGroup } from "./permission-groups";
import type { RoleItem } from "./types";

/**
 * Roles side by side: one column per role, one row per permission. Rows where the roles disagree
 * are emphasised so the differences stand out; the table scrolls on its own on narrow screens.
 */
function RoleMatrix({
  roles,
  groups,
  onOpenRole,
  caption,
}: {
  roles: RoleItem[];
  groups: PermissionGroup[];
  onOpenRole: (key: string) => void;
  caption: string;
}) {
  const granted = roles.map((role) => new Set(role.permissions));
  const knownCount = groups.reduce((total, group) => total + group.permissions.length, 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
      <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th
              className="sticky left-0 z-20 min-w-56 border-b border-border bg-card px-4 py-3 text-left font-medium text-muted-foreground"
              scope="col"
            >
              Permission
            </th>
            {roles.map((role) => (
              <th
                className="min-w-24 border-b border-border px-2 py-3 text-center align-bottom font-medium"
                key={role.id}
                scope="col"
              >
                <button
                  className="inline-grid justify-items-center gap-0.5 rounded-md px-2 py-1 hover:bg-accent focus-visible:bg-accent"
                  onClick={() => onOpenRole(role.key)}
                  title={`Open ${role.name}`}
                  type="button"
                >
                  <span>{role.name}</span>
                  <span className="text-2xs font-normal text-muted-foreground">
                    {role.isSystem ? "Built-in" : "Custom"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.id}>
              <tr>
                <th
                  className="sticky left-0 z-10 border-b border-border bg-muted px-4 py-1.5 text-left text-2xs font-medium tracking-wider text-muted-foreground uppercase"
                  scope="rowgroup"
                >
                  {group.label}
                </th>
                <td className="border-b border-border bg-muted" colSpan={roles.length} />
              </tr>
              {group.permissions.map((permission) => {
                const cells = granted.map((set) => set.has(permission.value));
                const differs = cells.some(Boolean) && !cells.every(Boolean);
                return (
                  <tr className="group" key={permission.value}>
                    <th
                      className={cn(
                        "sticky left-0 z-10 border-b border-border bg-card px-4 py-2 text-left font-normal group-hover:bg-muted",
                        !differs && "text-muted-foreground",
                      )}
                      scope="row"
                      title={permission.description}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {permission.label}
                        {permission.sensitive ? (
                          <ShieldAlert
                            aria-label="Sensitive"
                            className="size-3.5 text-warning"
                            role="img"
                          />
                        ) : null}
                      </span>
                    </th>
                    {cells.map((has, column) => (
                      <td
                        className="border-b border-border px-2 py-2 text-center group-hover:bg-muted/60"
                        key={roles[column]!.id}
                      >
                        {has ? (
                          <Check
                            aria-label="Granted"
                            className="mx-auto size-4 text-success"
                            role="img"
                          />
                        ) : (
                          <span
                            aria-label="Not granted"
                            className="text-subtle-foreground"
                            role="img"
                          >
                            –
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th
              className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium text-muted-foreground"
              scope="row"
            >
              Total
            </th>
            {roles.map((role, column) => (
              <td className="px-2 py-3 text-center font-medium tabular" key={role.id}>
                {groups.reduce(
                  (total, group) =>
                    total +
                    group.permissions.filter((permission) => granted[column]!.has(permission.value))
                      .length,
                  0,
                )}
                <span className="text-muted-foreground">/{knownCount}</span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export { RoleMatrix };
