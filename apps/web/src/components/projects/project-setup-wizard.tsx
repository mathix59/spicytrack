import { useState } from "react";
import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { CopyableCode } from "@/components/projects/sdk-snippets";
import {
  getSdkInstallSnippet,
  getSdkLanguage,
  getSdkSnippet,
  getSdkTestSnippet,
  platformLabel,
} from "@/components/projects/sdk-snippets-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useListProjectKeys } from "@/generated/api";
import { PLATFORM_OPTIONS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

import { FirstEventIndicator } from "./project-keys-tab/first-event-indicator";
import { TestEventButton } from "./project-keys-tab/test-event-button";
import { useFirstEventStatus } from "./project-keys-tab/use-first-event-status";
import { SETUP_PLATFORMS } from "./project-keys-tab/utils";
import { SetupComplete } from "./project-setup-wizard/setup-complete";
import { type StepKey, Stepper, STEPS } from "./project-setup-wizard/setup-stepper";

/** Guided setup for a project that has not received its first SDK event yet. */
function ProjectSetupWizard({
  orgSlug,
  projectSlug,
  projectPlatform,
}: {
  orgSlug: string;
  projectSlug: string;
  projectPlatform: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("step");
  const stepIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.key === requested),
  );
  const [platform, setPlatform] = useState(
    SETUP_PLATFORMS.includes(projectPlatform) ? projectPlatform : "javascript",
  );
  const keysQuery = useListProjectKeys(orgSlug, projectSlug);
  const firstEvent = useFirstEventStatus(orgSlug, projectSlug);
  const keys = keysQuery.data?.data ?? [];
  const dsn = (keys.find((key) => key.isActive) ?? keys[0])?.dsn;
  const label = platformLabel(platform);
  const language = getSdkLanguage(platform);
  const issuesHref = `/orgs/${orgSlug}/projects/${projectSlug}?tab=observability`;
  const keysHref = `/orgs/${orgSlug}/projects/${projectSlug}?tab=keys`;

  const goTo = (key: StepKey) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set("step", key);
        return next;
      },
      { replace: true },
    );

  if (firstEvent.state === "received") {
    return <SetupComplete issuesHref={issuesHref} orgSlug={orgSlug} projectSlug={projectSlug} />;
  }

  return (
    <Card className="min-w-0">
      <CardHeader className="gap-4">
        <div className="grid gap-1">
          <CardTitle>Get your first event</CardTitle>
          <CardDescription>
            Three steps, a few minutes. This page notices your first event on its own.
          </CardDescription>
        </div>
        <Stepper current={stepIndex} done={false} />
      </CardHeader>
      <CardContent className="grid gap-6">
        {stepIndex === 0 ? (
          <div className="grid gap-3">
            <h3 className="text-sm font-medium">Which SDK will send errors?</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {PLATFORM_OPTIONS.filter((option) => SETUP_PLATFORMS.includes(option.value)).map(
                (option) => (
                  <button
                    aria-pressed={platform === option.value}
                    className={cn(
                      "rounded-lg border border-border px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      platform === option.value &&
                        "border-primary bg-primary/5 text-primary-accent hover:bg-primary/10",
                    )}
                    key={option.value}
                    onClick={() => setPlatform(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ),
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              SpicyTrack speaks the Sentry protocol: any Sentry SDK works, including ones not listed
              here.
            </p>
          </div>
        ) : null}

        {stepIndex === 1 ? (
          keysQuery.isPending ? (
            <div className="grid gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : !dsn ? (
            <EmptyState
              action={
                <Button asChild size="sm">
                  <Link to={keysHref}>Manage keys</Link>
                </Button>
              }
              description="This project has no client key. Create one to get a DSN."
              icon={KeyRound}
              title="No DSN yet"
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">1. Install the {label} SDK</h3>
                <CopyableCode label={`${label} install`} value={getSdkInstallSnippet(platform)} />
              </div>
              <div className="grid gap-2">
                <h3 className="text-sm font-medium">
                  2. Initialize it as early as possible, with your DSN
                </h3>
                <CopyableCode
                  label={`${label} init`}
                  language={language}
                  value={getSdkSnippet(platform, dsn)}
                />
              </div>
            </div>
          )
        ) : null}

        {stepIndex === 2 ? (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Check SpicyTrack first (optional)</h3>
              <p className="text-sm text-muted-foreground">
                A sample error goes through ingestion, grouping and your alert rules, without
                touching your app.
              </p>
              <TestEventButton orgSlug={orgSlug} projectSlug={projectSlug} />
            </div>
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">Then raise an error from your app</h3>
              <CopyableCode
                label="Test error"
                language={language}
                value={getSdkTestSnippet(platform)}
              />
            </div>
            <FirstEventIndicator issuesHref={issuesHref} status={firstEvent} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          {stepIndex > 0 ? (
            <Button onClick={() => goTo(STEPS[stepIndex - 1]!.key)} type="button" variant="ghost">
              <ArrowLeft />
              Back
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link to={issuesHref}>Skip for now</Link>
            </Button>
          )}
          {stepIndex < STEPS.length - 1 ? (
            <Button
              disabled={stepIndex === 1 && !dsn}
              onClick={() => goTo(STEPS[stepIndex + 1]!.key)}
              type="button"
            >
              Next
              <ArrowRight />
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export { ProjectSetupWizard };
