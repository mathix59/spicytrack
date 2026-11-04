import { Bookmark, BookmarkPlus, FilterX } from "lucide-react";

import type { SavedIssueSearch } from "@/features/issues/saved-searches";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function SavedViewsMenu({
  savedSearches,
  applySavedSearch,
  removeSavedSearch,
  setSaveSearchOpen,
  clearIssueFilters,
}: {
  savedSearches: SavedIssueSearch[];
  applySavedSearch: (search: SavedIssueSearch) => void;
  removeSavedSearch: (id: string) => void;
  setSaveSearchOpen: (open: boolean) => void;
  clearIssueFilters: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Saved views" size="sm" type="button" variant="ghost">
          <Bookmark className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {savedSearches.length > 0 ? (
          <>
            <DropdownMenuLabel>Saved views</DropdownMenuLabel>
            {savedSearches.map((search) => (
              <DropdownMenuItem
                className="flex items-center gap-3"
                key={search.id}
                onClick={() => applySavedSearch(search)}
              >
                <span className="min-w-0 flex-1 truncate">{search.name}</span>
                <button
                  aria-label={`Remove saved view ${search.name}`}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeSavedSearch(search.id);
                  }}
                  type="button"
                >
                  <FilterX className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={() => setSaveSearchOpen(true)}>
          <BookmarkPlus className="size-4" />
          Save current view
        </DropdownMenuItem>
        <DropdownMenuItem onClick={clearIssueFilters}>
          <FilterX className="size-4" />
          Reset filters
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { SavedViewsMenu };
