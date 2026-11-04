import type { OrganizationDto } from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { ORGANIZATION_NAME_MAX_LENGTH, useOrganizationRename } from "./use-organization-rename";

/** Renames the organization. Its slug, and so every URL and SDK setting, stays the same. */
function OrganizationRenameForm({
  organization,
}: {
  organization: Pick<OrganizationDto, "name" | "slug">;
}) {
  const rename = useOrganizationRename(organization);

  return (
    <form className="grid gap-3" onSubmit={(event) => void rename.submit(event)}>
      <Field hint="Renaming does not change the slug or any URL." label="Name">
        <Input
          autoComplete="off"
          maxLength={ORGANIZATION_NAME_MAX_LENGTH}
          name="name"
          onChange={(event) => rename.setName(event.target.value)}
          required
          value={rename.name}
        />
      </Field>
      {rename.error ? (
        <Alert variant="destructive">
          <AlertDescription>{rename.error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button disabled={!rename.canSubmit} type="submit">
          {rename.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export { OrganizationRenameForm };
