import { Download, ExternalLink, Info } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { APP_VERSION } from "@/lib/app-version";
import { orvalFetch } from "@/lib/orval-fetch";
import { isVersionNewer } from "./app-update-utils";

type UpdateInformation = {
  enabled: boolean;
  latestVersion?: string;
  releaseNotesUrl?: string;
  upgradeGuideUrl?: string;
  checkedAt?: string;
};

export function AppUpdateNotice({ enabled }: { enabled: boolean }) {
  const [information, setInformation] = useState<UpdateInformation | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void orvalFetch<{ data: UpdateInformation }>("/instance-admin/update", { method: "GET" })
      .then((response) => setInformation(response.data))
      .catch(() => {
        // Update checks are informational and must never interrupt the application.
      });
  }, [enabled]);

  if (
    !information?.enabled ||
    !information.latestVersion ||
    !isVersionNewer(information.latestVersion, APP_VERSION)
  ) {
    return null;
  }

  return (
    <div className="border-t border-border p-3">
      <Dialog>
        <DialogTrigger asChild>
          <button
            className="flex w-full items-center gap-2 rounded-md border border-success/35 bg-success/10 px-3 py-2.5 text-left text-sm font-medium text-success transition-colors hover:bg-success/15"
            type="button"
          >
            <Download className="size-4" />
            <span className="flex-1">Update available</span>
            <span className="size-2 rounded-full bg-success" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SpicyTrack update available</DialogTitle>
            <DialogDescription>
              Review the release notes and your deployment procedure before updating the instance.
              SpicyTrack will not perform the update automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm">
            <div>
              <p className="text-muted-foreground">Installed</p>
              <p className="mt-1 font-mono font-semibold">v{APP_VERSION}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Latest</p>
              <p className="mt-1 font-mono font-semibold text-success">
                v{information.latestVersion}
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-md border border-info/25 bg-info/10 p-4 text-sm text-info">
            <Info className="mt-0.5 size-4 shrink-0" />
            <p>
              Back up PostgreSQL and object storage, then follow the instructions for your
              deployment method. Updates remain fully operator-controlled.
            </p>
          </div>

          <DialogFooter>
            {information.upgradeGuideUrl ? (
              <Button asChild variant="outline">
                <a href={information.upgradeGuideUrl} rel="noreferrer" target="_blank">
                  Upgrade guide <ExternalLink className="size-4" />
                </a>
              </Button>
            ) : null}
            {information.releaseNotesUrl ? (
              <Button asChild>
                <a href={information.releaseNotesUrl} rel="noreferrer" target="_blank">
                  Release notes <ExternalLink className="size-4" />
                </a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
