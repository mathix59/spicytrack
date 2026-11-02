import { KeyRound, Plus } from "lucide-react";

import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";

import { CreateProjectKeyDialog, ManageProjectKeyDialog } from "./project-key-dialogs";
import { ProjectKeyItem } from "./project-key-item";
import type { ProjectKeysTabData } from "./types";

function ProjectKeyListCard({ state }: { state: ProjectKeysTabData }) {
  const { keys, managedKey } = state;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              <CardTitle>Keys / DSN</CardTitle>
              {state.isLoading ? null : <Badge variant="muted">{keys.length}</Badge>}
            </div>
            <CardDescription>
              Each key has its own DSN, so you can disable or rotate one client at a time.
            </CardDescription>
          </div>
          <CreateProjectKeyDialog
            error={state.createError}
            isPending={state.isCreating}
            onOpenChange={state.setCreateOpen}
            onSubmit={state.createKey}
            open={state.createOpen}
            trigger={
              <Button size="sm" type="button">
                <Plus />
                New key
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {state.isLoading ? (
          <SkeletonRows className="[&>*]:h-32" rows={2} />
        ) : state.loadError ? (
          <QueryError
            error={state.loadError}
            onRetry={state.retry}
            title="Could not load project keys"
          />
        ) : keys.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={() => state.setCreateOpen(true)} size="sm" type="button">
                <Plus />
                Create a key
              </Button>
            }
            description="Generate a public key to start receiving envelopes from SDKs."
            icon={KeyRound}
            title="No keys yet"
          />
        ) : (
          <ul className="grid gap-4">
            {keys.map((key) => (
              <ProjectKeyItem
                isPrimary={state.primaryKey?.id === key.id}
                isUpdating={state.isUpdating}
                key={key.id}
                keyData={key}
                onManage={() => state.setManagedKey(key)}
                onRotate={() => state.rotateKey(key.id)}
                onSetActive={(isActive) => state.setKeyActive(key, isActive)}
              />
            ))}
          </ul>
        )}
        {managedKey ? (
          <ManageProjectKeyDialog
            error={state.manageError}
            isPending={state.isUpdating}
            keyData={managedKey}
            onOpenChange={(open) => {
              if (!open) state.setManagedKey(null);
            }}
            onSubmit={state.saveKey}
            open
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export { ProjectKeyListCard };
