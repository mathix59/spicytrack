import type { FormEvent } from "react";

import { FormDialogActions } from "@/components/common/form-dialog-actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { PermissionGroup } from "./permission-groups";
import { PermissionPicker } from "./permission-picker";

/** Name + grouped permissions form shared by organization and team role dialogs. */
function RoleForm({
  groups,
  nameLabel = "Role name",
  permissionsLegend = "Permissions",
  showKeys,
  role,
  error,
  isPending,
  submitLabel,
  onSubmit,
}: {
  groups: PermissionGroup[];
  nameLabel?: string;
  permissionsLegend?: string;
  showKeys?: boolean;
  role?: { name: string; permissions: string[] } | null;
  error: string | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field label={nameLabel}>
        <Input defaultValue={role?.name} name="name" required />
      </Field>
      <PermissionPicker
        defaultSelected={role?.permissions}
        groups={groups}
        legend={permissionsLegend}
        showKeys={showKeys}
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FormDialogActions isPending={isPending} submitLabel={submitLabel} />
    </form>
  );
}

export { RoleForm };
