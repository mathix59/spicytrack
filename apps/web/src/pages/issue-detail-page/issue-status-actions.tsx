import {
  BellOff,
  CheckCircle2,
  ChevronDown,
  LoaderCircle,
  RotateCcw,
  WandSparkles,
} from "lucide-react";

import { AutofixBlockerHint } from "@/components/autofix/autofix-blocker-hint";
import { focusAutofixCard } from "@/components/autofix/autofix-run-utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { IssueActionsState } from "./types";

const HOUR = 60 * 60 * 1000;
const SNOOZE_OPTIONS = [
  { label: "For 1 hour", duration: HOUR },
  { label: "For 24 hours", duration: 24 * HOUR },
  { label: "For 7 days", duration: 7 * 24 * HOUR },
] as const;

function IssueStatusActions({ status, actions }: { status: string; actions: IssueActionsState }) {
  const busy = actions.isUpdatingStatus;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {status === "open" ? (
        <div className="flex">
          <Button
            className="rounded-r-none"
            disabled={busy}
            onClick={() => void actions.updateStatus("resolved")}
            size="sm"
            type="button"
          >
            <CheckCircle2 />
            Resolve
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="More resolve options"
                className="rounded-l-none border-l border-primary-foreground/25 px-2"
                disabled={busy}
                size="sm"
                type="button"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onClick={() => void actions.updateStatus("resolved")}>
                <div className="grid gap-0.5">
                  <span>Resolve now</span>
                  <span className="text-xs text-muted-foreground">Reopens on the next event</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void actions.resolveInNextRelease()}>
                <div className="grid gap-0.5">
                  <span>Resolve in next release</span>
                  <span className="text-xs text-muted-foreground">
                    Ignores events from current releases
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button
          disabled={busy}
          onClick={() => void actions.updateStatus("open")}
          size="sm"
          type="button"
          variant="secondary"
        >
          <RotateCcw />
          Reopen
        </Button>
      )}
      {status !== "ignored" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={busy} size="sm" type="button" variant="outline">
              <BellOff />
              Ignore
              <ChevronDown className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Snooze</DropdownMenuLabel>
            {SNOOZE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option.label}
                onClick={() =>
                  void actions.updateStatus(
                    "ignored",
                    new Date(Date.now() + option.duration).toISOString(),
                  )
                }
              >
                {option.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void actions.updateStatus("ignored", null)}>
              Until manually reopened
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {busy ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : null}
      <AutofixAction actions={actions} />
    </div>
  );
}

const AUTOFIX_HINT_ID = "issue-autofix-unavailable";

/**
 * "Find root cause", or "Autofix running" (which jumps to the Autofix card). When Autofix
 * cannot start, the button stays visible but disabled, and says why.
 */
function AutofixAction({ actions }: { actions: IssueActionsState }) {
  if (actions.autofixInFlight) {
    return (
      <div className="ml-auto">
        <Button
          className="border-info/40 text-info hover:bg-info/10 hover:text-info"
          onClick={focusAutofixCard}
          size="sm"
          title="Show the Autofix run in progress"
          type="button"
          variant="outline"
        >
          <LoaderCircle className="motion-safe:animate-spin" />
          Autofix running
        </Button>
      </div>
    );
  }

  const blocker = actions.autofixBlocker;

  return (
    <div className="ml-auto grid justify-items-end gap-1">
      <Button
        aria-describedby={blocker ? AUTOFIX_HINT_ID : undefined}
        aria-disabled={blocker ? true : undefined}
        className="border-primary/40 text-primary-accent hover:bg-primary/10 hover:text-primary-accent aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-transparent"
        disabled={actions.isTriggeringAutofix}
        onClick={() => {
          if (!blocker) void actions.triggerAutofix();
        }}
        size="sm"
        title={
          blocker?.message ??
          "Find the root cause with AI, then optionally generate a fix and pull request"
        }
        type="button"
        variant="outline"
      >
        {actions.isTriggeringAutofix ? (
          <LoaderCircle className="motion-safe:animate-spin" />
        ) : (
          <WandSparkles />
        )}
        {actions.isTriggeringAutofix ? "Starting…" : "Find root cause"}
      </Button>
      {blocker ? (
        <AutofixBlockerHint
          blocker={blocker}
          className="max-w-xs text-right"
          id={AUTOFIX_HINT_ID}
        />
      ) : null}
    </div>
  );
}

export { IssueStatusActions };
