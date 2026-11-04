import { CircleHelp } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const SEARCH_SYNTAX: { example: string; description: string }[] = [
  {
    example: "is:unresolved",
    description: "Status: unresolved, resolved, ignored, regressed, assigned, unassigned",
  },
  { example: "level:error", description: "Level, or priority:high" },
  { example: "assigned:me", description: "Assignee: me, none or an email" },
  { example: "user.email:*@acme.com", description: "Affected user; * matches anything" },
  {
    example: "browser.name:Chrome",
    description: "Any tag, such as os.name, release, url or your own",
  },
  { example: "has:user.id", description: "Events carrying a tag" },
  { example: "age:-24h", description: "First seen in the last 24h; lastSeen:+7d for older" },
  { example: "timesSeen:>100", description: "Event count, with >, >=, < or <=" },
  { example: "!level:info", description: "Prefix any filter with ! to exclude it" },
];

function SearchSyntaxHelp({ onInsert }: { onInsert: (term: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Search syntax"
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          type="button"
        >
          <CircleHelp className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-label="Search syntax"
        className="grid w-96 max-w-[calc(100vw-2rem)] gap-2"
      >
        <p className="text-sm text-muted-foreground">
          Words match the title. Combine filters with spaces; quote values with spaces.
        </p>
        <ul className="grid gap-1">
          {SEARCH_SYNTAX.map((entry) => (
            <li key={entry.example}>
              <button
                className="grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                onClick={() => onInsert(entry.example)}
                type="button"
              >
                <code className="font-mono text-xs">{entry.example}</code>
                <span className="text-xs text-muted-foreground">{entry.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export { SearchSyntaxHelp };
