import { ArrowRight, PartyPopper } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Shown once the project received its first event. */
function SetupComplete({
  orgSlug,
  projectSlug,
  issuesHref,
}: {
  orgSlug: string;
  projectSlug: string;
  issuesHref: string;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="grid justify-items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <PartyPopper aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Your SDK is reporting</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          SpicyTrack received this project&apos;s first event. Set up alerts so the right people
          hear about new errors and regressions.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to={issuesHref}>
              View issues
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={`/orgs/${orgSlug}/projects/${projectSlug}?tab=alerting`}>Set up alerts</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { SetupComplete };
