import { useState } from "react";

import { CollapsibleSection } from "@/components/common/collapsible-section";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { KeyValueList, PREVIEW_LIMIT, ShowMoreButton } from "./key-value-list";
import type { PayloadRecord } from "./types";
import { asRecord, displayValue } from "./utils";

function breadcrumbTime(value: unknown) {
  const seconds =
    typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) / 1000 : NaN;
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

function BreadcrumbSummary({ breadcrumb }: { breadcrumb: PayloadRecord }) {
  const data = asRecord(breadcrumb.data);
  if (typeof breadcrumb.message === "string" && breadcrumb.message) {
    return <span className="truncate">{breadcrumb.message}</span>;
  }
  if (data && typeof data.url === "string") {
    const status = Number(data.status_code);
    return (
      <span className="flex min-w-0 items-baseline gap-2">
        {typeof data.method === "string" ? (
          <span className="shrink-0 text-muted-foreground">{data.method.toUpperCase()}</span>
        ) : null}
        <span className="min-w-0 truncate">{data.url}</span>
        {data.status_code !== undefined ? (
          <span
            className={cn(
              "shrink-0 tabular-nums",
              status >= 400 || status === 0 ? "text-destructive" : "text-success",
            )}
          >
            {String(data.status_code)}
          </span>
        ) : null}
      </span>
    );
  }
  if (data && typeof data.to === "string") {
    return (
      <span className="truncate">
        {typeof data.from === "string" ? `${data.from} → ` : ""}
        {data.to}
      </span>
    );
  }
  return <span className="truncate">{data ? JSON.stringify(data) : ""}</span>;
}

function breadcrumbCategory(breadcrumb: PayloadRecord) {
  return displayValue(breadcrumb.category ?? breadcrumb.type ?? "event");
}

function BreadcrumbRow({ breadcrumb }: { breadcrumb: PayloadRecord }) {
  const [open, setOpen] = useState(false);
  const data = asRecord(breadcrumb.data);
  const status = Number(data?.status_code);
  const failed = status >= 400 || status === 0 || breadcrumb.level === "error";
  const category = breadcrumbCategory(breadcrumb);
  const time = breadcrumbTime(breadcrumb.timestamp);
  const details = data && Object.keys(data).length > 0;

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        aria-expanded={details ? open : undefined}
        className={cn(
          "grid w-full min-w-0 grid-cols-[4.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 px-4 py-2 text-left text-xs sm:grid-cols-[4.5rem_8rem_minmax(0,1fr)]",
          details && "hover:bg-accent/40",
          failed && "bg-destructive/5",
        )}
        disabled={!details}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="whitespace-nowrap font-mono tabular-nums text-muted-foreground">
          {time ?? "—"}
        </span>
        <span
          className={cn(
            "truncate font-medium",
            failed ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {category}
        </span>
        <span className="col-span-2 min-w-0 font-mono text-foreground sm:col-span-1">
          <BreadcrumbSummary breadcrumb={breadcrumb} />
        </span>
      </button>
      {open && data ? (
        <div className="border-t border-border bg-background/60 px-4 py-3">
          <KeyValueList value={data} />
        </div>
      ) : null}
    </li>
  );
}

const ALL_CATEGORIES = "";

function BreadcrumbsSection({ breadcrumbs }: { breadcrumbs: PayloadRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  const [selectedCategory, setCategory] = useState(ALL_CATEGORIES);
  if (breadcrumbs.length === 0) return null;

  const categories = [...new Set(breadcrumbs.map(breadcrumbCategory))].sort();
  // The section outlives event changes; a category the new event lacks falls back to all.
  const category = categories.includes(selectedCategory) ? selectedCategory : ALL_CATEGORIES;
  // Most recent activity first: the crumbs closest to the error matter most. The category filter
  // applies before the preview limit so a rare category is not hidden behind "show more".
  const ordered = [...breadcrumbs]
    .reverse()
    .filter((breadcrumb) => !category || breadcrumbCategory(breadcrumb) === category);
  const visible = showAll ? ordered : ordered.slice(0, PREVIEW_LIMIT);

  return (
    <CollapsibleSection
      actions={
        categories.length > 1 ? (
          <Select
            aria-label="Filter breadcrumbs by category"
            className="h-7 max-w-40 py-0 pl-2 text-xs"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value={ALL_CATEGORIES}>All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        ) : null
      }
      summary={
        category
          ? `${ordered.length} of ${breadcrumbs.length} · most recent first`
          : `${breadcrumbs.length} · most recent first`
      }
      title="Breadcrumbs"
    >
      <ol className="min-w-0">
        {visible.map((breadcrumb, index) => (
          <BreadcrumbRow breadcrumb={breadcrumb} key={`${category}:${index}`} />
        ))}
      </ol>
      {ordered.length > PREVIEW_LIMIT ? (
        <ShowMoreButton
          expanded={showAll}
          hiddenCount={ordered.length - PREVIEW_LIMIT}
          onToggle={() => setShowAll((current) => !current)}
        />
      ) : null}
    </CollapsibleSection>
  );
}

export { BreadcrumbsSection };
