import type { ReactNode } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { McpSettingsState } from "./use-mcp-settings";

function Step({
  index,
  done,
  title,
  description,
  children,
}: {
  index: number;
  done: boolean;
  title: string;
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-md border border-border p-3">
      <Badge className="h-6 shrink-0 rounded-full px-2" variant={done ? "accent" : "muted"}>
        {index}
      </Badge>
      <div className="grid min-w-0 gap-1">
        <span className="text-sm font-medium">{title}</span>
        <p className="text-xs text-muted-foreground">{description}</p>
        {children}
      </div>
    </div>
  );
}

function DoneLabel({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 text-xs text-success">
      <CheckCircle2 className="size-3.5" /> {children}
    </span>
  );
}

function McpOnboardingDialog({ state }: { state: McpSettingsState }) {
  const enabled = state.data?.enabled ?? false;

  return (
    <Dialog onOpenChange={state.setOnboardingOpen} open={state.onboardingOpen}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect an AI client</DialogTitle>
          <DialogDescription>
            Give Claude Desktop, Cursor, or Codex scoped access to your SpicyTrack data in a few
            minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Step
            description="This enables the single MCP endpoint for keys created in this organization."
            done={enabled}
            index={1}
            title="Enable your organization server"
          >
            {!enabled ? (
              <Button
                className="mt-1 w-fit"
                disabled={state.isTogglingServer}
                onClick={() => state.setEnabled(true)}
                size="sm"
                type="button"
              >
                Enable MCP
              </Button>
            ) : (
              <DoneLabel>Enabled</DoneLabel>
            )}
          </Step>
          <Step
            description="Start read-only and select only the projects this client should see."
            done={Boolean(state.secret)}
            index={2}
            title="Create a scoped key"
          >
            {!state.secret ? (
              <Button
                className="mt-1 w-fit"
                disabled={!enabled}
                onClick={() => {
                  state.setOnboardingOpen(false);
                  state.setCreateOpen(true);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <KeyRound className="size-3.5" /> Create a key
              </Button>
            ) : (
              <DoneLabel>Key copied into this setup</DoneLabel>
            )}
          </Step>
          <Step
            description="Add this streamable HTTP server in your client’s MCP settings."
            done={Boolean(state.secret)}
            index={3}
            title="Paste the connection into your client"
          >
            <code className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded bg-muted px-2 py-1.5 text-xs">
              {state.clientConfig}
            </code>
            {state.secret ? (
              <CopyButton
                label="Copy configuration"
                showLabel
                successMessage="Configuration copied"
                value={state.clientConfig}
                variant="outline"
              />
            ) : null}
          </Step>
          <Step
            description="In the client, ask “List my SpicyTrack projects”, then use Check on the key to confirm its access."
            done={false}
            index={4}
            title="Verify the first connection"
          />
        </div>
        <DialogFooter>
          <Button onClick={() => state.setOnboardingOpen(false)} type="button">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { McpOnboardingDialog };
