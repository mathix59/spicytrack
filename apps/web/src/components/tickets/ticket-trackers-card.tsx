import { type FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import {
  type CreateTicketTrackerBodyDto,
  CreateTicketTrackerBodyDtoProvider,
  getListTicketTrackersQueryKey,
  useCreateTicketTracker,
  useDeleteTicketTracker,
  useListTicketTrackers,
} from "@/generated/api";
import { getErrorMessage } from "@/lib/utils";

import { PROVIDER_LABELS } from "./ticket-provider-labels";
import { type Provider, ProviderFields } from "./ticket-tracker-provider-fields";

function formValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Project issue trackers: where "Create ticket" on an issue sends it. */
function TicketTrackersCard({
  orgSlug,
  projectSlug,
  canManage,
}: {
  orgSlug: string;
  projectSlug: string;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const trackersQuery = useListTicketTrackers(orgSlug, projectSlug);
  const createTracker = useCreateTicketTracker();
  const deleteTracker = useDeleteTicketTracker();
  const [provider, setProvider] = useState<Provider>("github");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trackers = trackersQuery.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: getListTicketTrackersQueryKey(orgSlug, projectSlug),
    });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const data: CreateTicketTrackerBodyDto = {
      provider,
      name: formValue(form, "name") ?? PROVIDER_LABELS[provider],
      token: formValue(form, "token"),
      repository: formValue(form, "repository"),
      teamKey: formValue(form, "teamKey"),
      baseUrl: formValue(form, "baseUrl"),
      email: formValue(form, "email"),
      projectKey: formValue(form, "projectKey"),
      issueType: formValue(form, "issueType"),
    };
    try {
      await createTracker.mutateAsync({ orgSlug, projectSlug, data });
      toast.success("Tracker added");
      setAdding(false);
      await refresh();
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <Card className="min-w-0" data-testid="ticket-trackers">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Issue trackers</CardTitle>
            <CardDescription>
              Create GitHub, Linear or Jira tickets from an issue, prefilled with its stack trace.
              Credentials are checked when you add a tracker and stored encrypted.
            </CardDescription>
          </div>
          {canManage && !adding ? (
            <Button onClick={() => setAdding(true)} size="sm" type="button" variant="outline">
              <Plus />
              Add tracker
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {trackersQuery.isLoading ? (
          <SkeletonRows rows={2} />
        ) : trackersQuery.error ? (
          <QueryError
            error={trackersQuery.error}
            onRetry={() => void trackersQuery.refetch()}
            title="Could not load issue trackers"
          />
        ) : trackers.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">No issue tracker yet.</p>
        ) : (
          <ul className="grid gap-2">
            {trackers.map((tracker) => (
              <li
                className="flex min-w-0 items-center gap-3 rounded-lg border border-border px-3 py-2"
                key={tracker.id}
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{tracker.name}</span>
                    <Badge variant="muted">{PROVIDER_LABELS[tracker.provider]}</Badge>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">
                    {tracker.target}
                    {tracker.provider === "jira" && tracker.baseUrl ? ` · ${tracker.baseUrl}` : ""}
                  </span>
                </div>
                {canManage ? (
                  <ConfirmDialog
                    confirmLabel="Remove"
                    description="Tickets already created stay linked to their issues."
                    onConfirm={async () => {
                      await deleteTracker.mutateAsync({
                        orgSlug,
                        projectSlug,
                        trackerId: tracker.id,
                      });
                      await refresh();
                    }}
                    successMessage="Tracker removed"
                    title={`Remove ${tracker.name}?`}
                    trigger={
                      <Button
                        aria-label={`Remove ${tracker.name}`}
                        className="text-muted-foreground hover:text-destructive"
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 />
                      </Button>
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <form
            className="grid gap-4 rounded-lg border border-border p-4"
            key={provider}
            onSubmit={(event) => void submit(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tracker">
                <Select
                  name="provider"
                  onChange={(event) => {
                    setProvider(event.target.value as Provider);
                    setError(null);
                  }}
                  value={provider}
                >
                  {Object.values(CreateTicketTrackerBodyDtoProvider).map((value) => (
                    <option key={value} value={value}>
                      {PROVIDER_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Name">
                <Input maxLength={80} name="name" placeholder={PROVIDER_LABELS[provider]} />
              </Field>
            </div>
            <ProviderFields provider={provider} />
            {error ? (
              <Alert variant="destructive">
                <AlertDescription className="[overflow-wrap:anywhere]">{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={createTracker.isPending} size="sm" type="submit">
                {createTracker.isPending ? "Checking…" : "Add tracker"}
              </Button>
              <Button
                onClick={() => {
                  setAdding(false);
                  setError(null);
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { TicketTrackersCard };
