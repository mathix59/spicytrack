import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

function IssuesPagination({
  totalIssues,
  safePage,
  totalIssuePages,
  setPage,
}: {
  totalIssues: number;
  safePage: number;
  totalIssuePages: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-sm text-muted-foreground">
          {totalIssues} issues matching filters · page {safePage} of {totalIssuePages}
        </p>
        <p className="hidden items-center gap-1 text-xs text-muted-foreground lg:flex">
          <Kbd>j</Kbd>
          <Kbd>k</Kbd> navigate · <Kbd>x</Kbd> select · <Kbd>Enter</Kbd> open
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          disabled={safePage <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={safePage >= totalIssuePages}
          onClick={() => setPage((current) => Math.min(totalIssuePages, current + 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export { IssuesPagination };
