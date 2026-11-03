import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";

import { IssueStateBadge } from "@/components/issues/issue-status-controls";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { controlClassName } from "@/components/ui/control.styles";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { type IssueDto, useListIssues } from "@/generated/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn, formatRelativeTime } from "@/lib/utils";

const RESULT_LIMIT = 8;

/** Picks the issue to merge into by searching the project's issues (title, culprit, id, filters). */
function IssueMergePicker({
  orgSlug,
  projectSlug,
  issueId,
  disabled,
  onMerge,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
  disabled: boolean;
  onMerge: (targetIssueId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<IssueDto | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  const issuesQuery = useListIssues(
    orgSlug,
    projectSlug,
    { page: 1, pageSize: RESULT_LIMIT + 1, q: debouncedSearch || undefined },
    { query: { enabled: open, placeholderData: keepPreviousData, retry: false } },
  );
  const candidates = (issuesQuery.data?.data.items ?? [])
    .filter((issue) => issue.id !== issueId && !issue.mergedIntoIssueId)
    .slice(0, RESULT_LIMIT);

  return (
    <div className="grid gap-2">
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label="Target issue"
            className={cn(
              controlClassName,
              "flex h-9 cursor-pointer items-center gap-2 px-3 text-left text-sm",
            )}
            disabled={disabled}
            role="combobox"
            type="button"
          >
            <span className={cn("min-w-0 flex-1 truncate", !target && "text-subtle-foreground")}>
              {target?.title ?? "Search for an issue…"}
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={setSearch}
              placeholder="Title, culprit, issue ID or filters…"
              value={search}
            />
            <CommandList>
              <CommandEmpty>
                {issuesQuery.isFetching
                  ? "Searching…"
                  : issuesQuery.isError
                    ? "Invalid search."
                    : "No matching issue."}
              </CommandEmpty>
              <CommandGroup>
                {candidates.map((issue) => (
                  <CommandItem
                    key={issue.id}
                    onSelect={() => {
                      setTarget(issue);
                      setOpen(false);
                    }}
                    value={issue.id}
                  >
                    <span className="grid min-w-0 flex-1">
                      <span className="truncate">{issue.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {issue.timesSeen} {issue.timesSeen === 1 ? "event" : "events"} ·{" "}
                        {formatRelativeTime(issue.lastSeenAt)}
                        {issue.culprit ? ` · ${issue.culprit}` : ""}
                      </span>
                    </span>
                    <IssueStateBadge value={issue.status} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        className="justify-self-start"
        disabled={disabled || !target}
        onClick={() => {
          if (!target) return;
          void onMerge(target.id).then(() => setTarget(null));
        }}
        size="sm"
        type="button"
        variant="secondary"
      >
        Merge into this issue
      </Button>
    </div>
  );
}

export { IssueMergePicker };
