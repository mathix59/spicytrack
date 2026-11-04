import { type FormEvent, useId, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/utils";

/** Inline form that links a ticket created outside SpicyTrack by its URL. */
function LinkTicketForm({
  defaultValue,
  pending,
  onSave,
  onCancel,
}: {
  defaultValue: string;
  pending: boolean;
  onSave: (url: string) => Promise<void>;
  onCancel: () => void;
}) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const url = String(new FormData(event.currentTarget).get("externalIssueUrl") ?? "").trim();
    try {
      await onSave(url);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <form className="grid gap-2" onSubmit={(event) => void submit(event)}>
      <label className="text-xs font-medium text-muted-foreground" htmlFor={inputId}>
        Ticket URL
      </label>
      <Input
        // The form opens on request, so focus follows the person's intent.
        autoFocus
        defaultValue={defaultValue}
        id={inputId}
        name="externalIssueUrl"
        placeholder="https://linear.app/…"
        required
        type="url"
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="[overflow-wrap:anywhere]">{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button disabled={pending} size="sm" type="submit" variant="secondary">
          {pending ? "Saving…" : "Save link"}
        </Button>
        <Button disabled={pending} onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
      </div>
    </form>
  );
}

export { LinkTicketForm };
