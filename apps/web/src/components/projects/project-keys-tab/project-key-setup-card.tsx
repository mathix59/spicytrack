import type { ReactNode } from "react";
import { Plus, Rocket } from "lucide-react";

import { PLATFORM_OPTIONS } from "@/lib/platforms";
import {
  getSdkInstallSnippet,
  getSdkLanguage,
  getSdkSnippet,
  getSdkTestSnippet,
  platformLabel,
} from "@/components/projects/sdk-snippets-content";
import { CopyableCode } from "@/components/projects/sdk-snippets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { FirstEventIndicator } from "./first-event-indicator";
import { TestEventButton } from "./test-event-button";
import type { FirstEventStatus } from "./types";
import { SETUP_PLATFORMS } from "./utils";

function SetupStep({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-semibold text-muted-foreground"
      >
        {index}
      </span>
      <div className="grid min-w-0 gap-2 pt-0.5">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function ProjectKeySetupCard({
  dsn,
  isLoading,
  loadFailed,
  orgSlug,
  projectSlug,
  firstEvent,
  effectivePlatform,
  onPlatformChange,
  onCreateKey,
}: {
  dsn: string | undefined;
  isLoading: boolean;
  loadFailed: boolean;
  orgSlug: string;
  projectSlug: string;
  firstEvent: FirstEventStatus;
  effectivePlatform: string;
  onPlatformChange: (platform: string) => void;
  onCreateKey: () => void;
}) {
  const language = getSdkLanguage(effectivePlatform);
  const label = platformLabel(effectivePlatform);

  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Set up your SDK</CardTitle>
            <CardDescription>
              Send your first event in a few minutes. Snippets use the primary key&apos;s DSN.
            </CardDescription>
          </div>
          {dsn ? (
            <div className="w-full sm:w-44">
              <Select
                aria-label="SDK platform"
                onChange={(event) => onPlatformChange(event.target.value)}
                value={effectivePlatform}
              >
                {PLATFORM_OPTIONS.filter((option) => SETUP_PLATFORMS.includes(option.value)).map(
                  (option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </Select>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div aria-busy="true" aria-label="Loading setup" className="grid gap-3" role="status">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : loadFailed ? (
          <p className="text-sm text-muted-foreground">
            Setup instructions appear once the project keys load.
          </p>
        ) : !dsn ? (
          <EmptyState
            action={
              <Button onClick={onCreateKey} size="sm" type="button">
                <Plus />
                Create a key
              </Button>
            }
            description="Create an ingest key first, then copy its DSN and drop the snippet into your SDK setup."
            icon={Rocket}
            title="No ingest key yet"
          />
        ) : (
          <ol className="grid gap-6">
            <SetupStep index={1} title="Copy your DSN">
              <CopyableCode label="DSN" value={dsn} />
            </SetupStep>
            <SetupStep index={2} title={`Install the ${label} SDK`}>
              <CopyableCode
                label={`${label} install`}
                value={getSdkInstallSnippet(effectivePlatform)}
              />
            </SetupStep>
            <SetupStep index={3} title="Initialize it as early as possible">
              <CopyableCode
                label={`${label} init`}
                language={language}
                value={getSdkSnippet(effectivePlatform, dsn)}
              />
            </SetupStep>
            <SetupStep index={4} title="Send a test event">
              <TestEventButton orgSlug={orgSlug} projectSlug={projectSlug} />
              <p className="text-xs text-muted-foreground">
                Then confirm your SDK works by raising an error from your app:
              </p>
              <CopyableCode
                label="Test event"
                language={language}
                value={getSdkTestSnippet(effectivePlatform)}
              />
              <FirstEventIndicator
                issuesHref={`/orgs/${orgSlug}/projects/${projectSlug}?tab=observability`}
                status={firstEvent}
              />
            </SetupStep>
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export { ProjectKeySetupCard };
