import { useState } from "react";
import type { FormEvent } from "react";
import { ShieldAlert } from "lucide-react";

import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { permissionIndex, type PermissionGroup } from "./permission-groups";
import { PermissionPicker } from "./permission-picker";
import type { RoleFormValues, RoleItem } from "./types";

const BLANK = "";

/**
 * Name, description and grouped permissions, shared by organization and team role dialogs.
 * - create: optionally starts from an existing role and marks what differs from it;
 * - edit: marks what differs from the saved role.
 * Newly granted sensitive permissions need an explicit second confirmation.
 */
function RoleForm({
  mode,
  groups,
  roles = [],
  role,
  startFrom,
  nameLabel = "Role name",
  permissionsLegend = "Permissions",
  showKeys,
  error,
  isPending,
  submitLabel,
  onSubmit,
}: {
  mode: "create" | "edit";
  groups: PermissionGroup[];
  /** Roles offered in "Start from" when creating. */
  roles?: RoleItem[];
  /** The role being edited. */
  role?: RoleItem | null;
  /** Prefills a new role from an existing one (Duplicate). */
  startFrom?: RoleItem | null;
  nameLabel?: string;
  permissionsLegend?: string;
  showKeys?: boolean;
  error: string | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: RoleFormValues) => void | Promise<void>;
}) {
  const source = mode === "edit" ? role : startFrom;
  const [name, setName] = useState(() =>
    mode === "edit" ? (role?.name ?? "") : startFrom ? `${startFrom.name} copy` : "",
  );
  const [description, setDescription] = useState(() =>
    mode === "edit" ? (role?.description ?? "") : "",
  );
  const [baseKey, setBaseKey] = useState(startFrom?.key ?? BLANK);
  const [selected, setSelected] = useState(() => new Set(source?.permissions ?? []));
  const [confirming, setConfirming] = useState(false);

  const baseRole = mode === "edit" ? role : roles.find((item) => item.key === baseKey);
  const baseline = baseRole ? new Set(baseRole.permissions) : undefined;
  const index = permissionIndex(groups);
  const added = [...selected].filter((value) => !baseline?.has(value));
  const removed = baseline ? [...baseline].filter((value) => !selected.has(value)) : [];
  // A new role grants everything it holds; an edited one only what it did not have yet.
  const savedPermissions = new Set(mode === "edit" ? (role?.permissions ?? []) : []);
  const newlySensitive = [...selected]
    .filter((value) => !savedPermissions.has(value))
    .map((value) => index.get(value))
    .filter((permission) => permission?.sensitive);

  const startFromRole = (key: string) => {
    setBaseKey(key);
    const next = roles.find((item) => item.key === key);
    setSelected(new Set(next?.permissions ?? []));
    setConfirming(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newlySensitive.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    void onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      permissions: [...selected],
    });
  };

  const comparedWith = mode === "edit" ? "the saved role" : baseRole ? baseRole.name : null;

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={nameLabel}>
          <Input
            name="name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        {mode === "create" && roles.length > 0 ? (
          <Field hint="Copies its permissions; you can adjust them below." label="Start from">
            <Select onChange={(event) => startFromRole(event.target.value)} value={baseKey}>
              <option value={BLANK}>Blank role</option>
              {roles.map((item) => (
                <option key={item.id} value={item.key}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
      </div>
      <Field hint="Shown next to the role so people know when to use it." label="Description">
        <Textarea
          className="min-h-16"
          maxLength={280}
          name="description"
          onChange={(event) => setDescription(event.target.value)}
          placeholder="e.g. On-call engineers who triage issues but don't change settings"
          value={description}
        />
      </Field>

      {comparedWith && (added.length > 0 || removed.length > 0) ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          Compared with {comparedWith}:{" "}
          <span className="font-medium text-success">{added.length} added</span>
          {" · "}
          <span className="font-medium text-destructive">{removed.length} removed</span>
        </p>
      ) : null}

      <PermissionPicker
        baseline={baseline}
        groups={groups}
        legend={permissionsLegend}
        onChange={(next) => {
          setSelected(next);
          setConfirming(false);
        }}
        selected={selected}
        showKeys={showKeys}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {confirming ? (
        <Alert variant="warning">
          <ShieldAlert />
          <AlertTitle>This role grants sensitive permissions</AlertTitle>
          <AlertDescription>
            <p>Everyone with this role will be able to:</p>
            <ul className="mt-1 list-disc pl-5">
              {newlySensitive.map((permission) => (
                <li key={permission!.value}>
                  <span className="font-medium text-foreground">{permission!.label}</span>
                  {" — "}
                  {permission!.description}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {confirming ? (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={() => setConfirming(false)} type="button" variant="ghost">
            Back
          </Button>
          <Button disabled={isPending} type="submit">
            Grant and {mode === "edit" ? "save" : "create"}
          </Button>
        </div>
      ) : (
        <FormDialogActions isPending={isPending} submitLabel={submitLabel} />
      )}
    </form>
  );
}

export { RoleForm };
