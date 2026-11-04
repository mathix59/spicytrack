import { useState } from "react";
import { ExternalLink, Link2, Ticket, X } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { QueryError } from "@/components/common/query-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useListIssueTickets } from "@/generated/api";
import { formatLocalDateTime, formatRelativeTime, getErrorMessage } from "@/lib/utils";

import { CreateTicketDialog } from "./create-ticket-dialog";
import { LinkTicketForm } from "./link-ticket-form";
import { PROVIDER_LABELS } from "./ticket-provider-labels";

/** A readable label for a manually linked ticket URL: host and path, without the scheme. */
function linkLabel(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

/** The ticket linked by URL, shown as one more row of the list. */
function LinkedTicketRow({
  url,
  canManage,
  pending,
  onRemove,
}: {
  url: string;
  canManage: boolean;
  pending: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="flex min-w-0 items-start gap-2">
      <div className="min-w-0 flex-1">
        <a
          className="group flex min-w-0 items-center gap-2 text-sm"
          href={url}
          rel="noreferrer noopener"
          target="_blank"
        >
          <Link2 aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate group-hover:underline">{linkLabel(url)}</span>
          <ExternalLink aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
        </a>
        <p className="text-xs text-muted-foreground">Linked manually</p>
      </div>
      {canManage ? (
        <Button
          aria-label="Remove linked ticket"
          disabled={pending}
          onClick={onRemove}
          size="icon-sm"
          title="Remove linked ticket"
          type="button"
          variant="ghost"
        >
          <X />
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Tickets for this issue: those created from SpicyTrack in a connected tracker, and one ticket
 * linked by URL. Managing them needs project.issues.manage.
 */
function IssueTicketsCard({
  orgSlug,
  projectSlug,
  issueId,
  canManage,
  canManageIntegrations,
  externalIssueUrl,
  onSaveExternalLink,
  isSavingExternalLink,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  canManage: boolean;
  canManageIntegrations: boolean;
  externalIssueUrl: string | null | undefined;
  /** Saves (or, with null, removes) the ticket linked by URL; rejects with the API error. */
  onSaveExternalLink: (url: string | null) => Promise<void>;
  isSavingExternalLink: boolean;
}) {
  const ticketsQuery = useListIssueTickets(orgSlug, projectSlug, issueId);
  const [open, setOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const data = ticketsQuery.data?.data;
  const tickets = data?.tickets ?? [];
  const trackers = data?.trackers ?? [];
  const hasTickets = tickets.length > 0 || Boolean(externalIssueUrl);

  return (
    <Card className="min-w-0" data-testid="issue-tickets">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Tickets</CardTitle>
        {canManage && trackers.length > 0 ? (
          <Button onClick={() => setOpen(true)} size="sm" type="button" variant="outline">
            <Ticket />
            Create ticket
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {ticketsQuery.isLoading ? (
          <SkeletonRows rows={1} />
        ) : ticketsQuery.isError ? (
          <QueryError
            error={ticketsQuery.error}
            onRetry={() => void ticketsQuery.refetch()}
            title="Could not load tickets"
          />
        ) : hasTickets ? (
          <ul className="grid gap-2">
            {tickets.map((ticket) => (
              <li className="min-w-0" key={ticket.id}>
                <a
                  className="group flex min-w-0 items-center gap-2 text-sm"
                  href={ticket.url}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  <span className="shrink-0 font-mono text-xs font-medium text-primary-accent">
                    {ticket.externalKey}
                  </span>
                  <span className="min-w-0 truncate group-hover:underline">{ticket.title}</span>
                  <ExternalLink
                    aria-hidden="true"
                    className="size-3 shrink-0 text-muted-foreground"
                  />
                </a>
                <p className="text-xs text-muted-foreground">
                  {PROVIDER_LABELS[ticket.provider]} ·{" "}
                  <time dateTime={ticket.createdAt} title={formatLocalDateTime(ticket.createdAt)}>
                    {formatRelativeTime(ticket.createdAt)}
                  </time>
                </p>
              </li>
            ))}
            {externalIssueUrl ? (
              <LinkedTicketRow
                canManage={canManage}
                onRemove={() =>
                  void onSaveExternalLink(null).catch((error: unknown) =>
                    toast.error("Could not remove the linked ticket", {
                      description: getErrorMessage(error),
                    }),
                  )
                }
                pending={isSavingExternalLink}
                url={externalIssueUrl}
              />
            ) : null}
          </ul>
        ) : trackers.length > 0 ? (
          <p className="text-sm text-muted-foreground">No ticket yet.</p>
        ) : canManageIntegrations ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask a project admin to connect GitHub, Linear or Jira.
          </p>
        )}

        {canManage ? (
          linking ? (
            <LinkTicketForm
              defaultValue={externalIssueUrl ?? ""}
              onCancel={() => setLinking(false)}
              onSave={async (url) => {
                await onSaveExternalLink(url);
                setLinking(false);
              }}
              pending={isSavingExternalLink}
            />
          ) : (
            <Button
              className="justify-self-start px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => setLinking(true)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Link2 />
              {externalIssueUrl ? "Replace linked ticket" : "Link existing ticket"}
            </Button>
          )
        ) : null}
      </CardContent>
      {canManage && trackers.length > 0 ? (
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
