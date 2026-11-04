import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getGetIssueQueryKey,
  getListIssueTicketsQueryKey,
  useCreateIssueTicket,
  useGetIssueTicketDraft,
} from "@/generated/api";
import { invalidateQueryKeys } from "@/lib/query-utils";
import { getErrorMessage } from "@/lib/utils";

const EMPTY_DRAFT = { title: "", description: "" };

/** Reviews the generated title and description, then creates the ticket in a tracker. */
function CreateTicketDialog({
  orgSlug,
  projectSlug,
  issueId,
  trackers,
  open,
  onOpenChange,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  trackers: Array<{ id: string; name: string; target: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const draftQuery = useGetIssueTicketDraft(orgSlug, projectSlug, issueId, {
    query: { enabled: open, staleTime: 0, gcTime: 0, retry: false },
  });
  const createTicket = useCreateIssueTicket();
  const [error, setError] = useState<string | null>(null);
  const pending = createTicket.isPending;
  // Without a generated draft, the form still opens with empty fields.
  const draft = draftQuery.data?.data ?? EMPTY_DRAFT;

  function changeOpen(next: boolean) {
    // A ticket being created cannot be abandoned half-way.
    if (!next && pending) return;
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await createTicket.mutateAsync({
        orgSlug,
        projectSlug,
        issueId,
        data: {
          trackerId: String(form.get("trackerId")),
          title: String(form.get("title") ?? ""),
          description: String(form.get("description") ?? ""),
        },
      });
      toast.success(`Ticket ${response.data.externalKey} created`, {
        action: {
          label: "Open",
          onClick: () => window.open(response.data.url, "_blank", "noopener,noreferrer"),
        },
      });
      onOpenChange(false);
      await invalidateQueryKeys(queryClient, [
        getListIssueTicketsQueryKey(orgSlug, projectSlug, issueId),
        getGetIssueQueryKey(orgSlug, projectSlug, issueId),
      ]);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create ticket</DialogTitle>
          <DialogDescription>
            The ticket links back to this issue. Review the description before sending: it leaves
            SpicyTrack.
          </DialogDescription>
        </DialogHeader>
        {draftQuery.isLoading ? (
          <SkeletonRows rows={4} />
        ) : draftQuery.isError ? (
          <QueryError
            error={draftQuery.error}
            onRetry={() => void draftQuery.refetch()}
            title="Could not prepare the ticket"
          />
        ) : (
          <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            <Field label="Tracker">
              <Select defaultValue={trackers[0]?.id} disabled={pending} name="trackerId" required>
                {trackers.map((tracker) => (
                  <option key={tracker.id} value={tracker.id}>
                    {tracker.name} · {tracker.target}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title">
              <Input
                defaultValue={draft.title}
                maxLength={255}
                name="title"
                readOnly={pending}
                required
              />
            </Field>
            <Field hint="Markdown." label="Description">
              <Textarea
                className="min-h-56 font-mono text-xs"
                defaultValue={draft.description}
                maxLength={20000}
                name="description"
                readOnly={pending}
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription className="[overflow-wrap:anywhere]">{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() => changeOpen(false)}
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
              <Button disabled={pending} type="submit">
                {pending ? "Creating…" : "Create ticket"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { CreateTicketDialog };
