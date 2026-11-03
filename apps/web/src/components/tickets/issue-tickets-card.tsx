import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
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
  useListIssueTickets,
} from "@/generated/api";
import { formatRelativeTime, getErrorMessage } from "@/lib/utils";

import { PROVIDER_LABELS } from "./ticket-provider-labels";

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
    query: { enabled: open, staleTime: 0, gcTime: 0 },
  });
  const createTicket = useCreateIssueTicket();
  const [error, setError] = useState<string | null>(null);
  const draft = draftQuery.data?.data;

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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getListIssueTicketsQueryKey(orgSlug, projectSlug, issueId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetIssueQueryKey(orgSlug, projectSlug, issueId),
        }),
      ]);
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      open={open}
    >
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
        ) : draftQuery.error ? (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(draftQuery.error)}</AlertDescription>
          </Alert>
        ) : draft ? (
          <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
            <Field label="Tracker">
              <Select defaultValue={trackers[0]?.id} name="trackerId" required>
                {trackers.map((tracker) => (
                  <option key={tracker.id} value={tracker.id}>
                    {tracker.name} · {tracker.target}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title">
              <Input defaultValue={draft.title} maxLength={255} name="title" required />
            </Field>
            <Field hint="Markdown." label="Description">
              <Textarea
                className="min-h-56 font-mono text-xs"
                defaultValue={draft.description}
                maxLength={20000}
                name="description"
              />
            </Field>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription className="[overflow-wrap:anywhere]">{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={createTicket.isPending} type="submit">
                {createTicket.isPending ? "Creating…" : "Create ticket"}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Tickets created from this issue, and the button to create one. */
function IssueTicketsCard({
  orgSlug,
  projectSlug,
  issueId,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
}) {
  const ticketsQuery = useListIssueTickets(orgSlug, projectSlug, issueId);
  const [open, setOpen] = useState(false);
  const data = ticketsQuery.data?.data;
  const tickets = data?.tickets ?? [];
  const trackers = data?.trackers ?? [];

  return (
    <Card className="min-w-0" data-testid="issue-tickets">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Tickets</CardTitle>
        {trackers.length > 0 ? (
          <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
            <Ticket />
            Create ticket
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {ticketsQuery.isLoading ? (
          <SkeletonRows rows={1} />
        ) : tickets.length > 0 ? (
          <ul className="grid gap-2">
            {tickets.map((ticket) => (
              <li className="min-w-0" key={ticket.id}>
                <a
                  className="group flex min-w-0 items-center gap-2 text-sm"
                  href={ticket.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="shrink-0 font-mono text-xs font-medium text-primary-accent">
                    {ticket.externalKey}
                  </span>
                  <span className="min-w-0 truncate group-hover:underline">{ticket.title}</span>
                  <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {PROVIDER_LABELS[ticket.provider]} · {formatRelativeTime(ticket.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : trackers.length > 0 ? (
          <p className="text-sm text-muted-foreground">No ticket yet.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add GitHub, Linear or Jira in{" "}
            <Link
              className="font-medium text-primary-accent hover:underline"
              to={`/orgs/${orgSlug}/projects/${projectSlug}?tab=integrations&integration=tickets`}
            >
              project integrations
            </Link>{" "}
            to create tickets from issues.
          </p>
        )}
      </CardContent>
      {trackers.length > 0 ? (
        <CreateTicketDialog
          issueId={issueId}
          onOpenChange={setOpen}
          open={open}
          orgSlug={orgSlug}
          projectSlug={projectSlug}
          trackers={trackers}
        />
      ) : null}
    </Card>
  );
}

export { IssueTicketsCard };
