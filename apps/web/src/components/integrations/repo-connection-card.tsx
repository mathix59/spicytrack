import { Unplug } from "lucide-react";

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

import { GithubHostingFields } from "./repo-connection/github-hosting-fields";
import { RepositoryFields } from "./repo-connection/repository-fields";
import { useRepoConnection } from "./repo-connection/use-repo-connection";
import { asOptionalString } from "./repo-connection/utils";

function RepoConnectionCard({
  orgSlug,
  projectSlug,
  canManage,
}: {
  orgSlug: string;
  projectSlug: string;
  canManage: boolean;
}) {
  const state = useRepoConnection({ orgSlug, projectSlug, canManage });
  const { connection, provider } = state;
  const disabled = !canManage;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <CardTitle>Repository</CardTitle>
              {connection ? <Badge variant="success">connected</Badge> : null}
            </div>
            <CardDescription>
              {connection
                ? `Linked to ${connection.repoIdentifier}. Used for source context and autofix.`
                : "Link the repository this project's code lives in to enable source context and autofix."}
            </CardDescription>
          </div>
          {connection ? (
            <ConfirmDialog
              confirmLabel="Disconnect"
              description="Autofix will stop working for this project until a new repository is connected."
              onConfirm={state.disconnect}
              successMessage="Repository disconnected"
              title="Disconnect repository?"
              trigger={
                <Button
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={disabled}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Unplug />
                  Disconnect
                </Button>
              }
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {state.isLoading ? (
          <SkeletonRows rows={4} />
        ) : state.loadError ? (
          <QueryError
            error={state.loadError}
            onRetry={state.retry}
            title="Could not load the repository connection"
          />
        ) : (
          // Re-mount when the stored connection changes so defaultValue inputs pick up new data.
          <form
            className="grid gap-4"
            key={connection ? `${connection.id}:${connection.updatedAt}` : "new"}
            onSubmit={(event) => void state.save(event)}
          >
            <Field label="Provider">
              <Select
                disabled={disabled}
                name="provider"
                onChange={(event) => state.changeProvider(event.target.value)}
                value={provider}
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </Select>
            </Field>
            {provider === "github" ? (
              <GithubHostingFields
                connection={connection}
                disabled={disabled}
                githubMode={state.githubMode}
                onGithubModeChange={state.setGithubMode}
              />
            ) : (
              <Field
                hint="Leave empty for gitlab.com; set for a self-hosted instance."
                label="Base URL"
              >
                <Input
                  defaultValue={asOptionalString(connection?.baseUrl)}
                  disabled={disabled}
                  name="baseUrl"
                  placeholder="https://gitlab.example.com"
                />
              </Field>
            )}
            <RepositoryFields disabled={disabled} state={state} />

            {state.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={disabled || state.isSaving} type="submit">
                {state.isSaving ? "Saving…" : "Save"}
              </Button>
              <Button
                disabled={disabled || state.isTesting}
                onClick={(event) => void state.test(event.currentTarget.form)}
                type="button"
                variant="secondary"
              >
                {state.isTesting ? "Testing…" : "Test connection"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export { RepoConnectionCard };
