import { useState } from "react";

import { CollapsibleSection } from "@/components/common/collapsible-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { PackageEntry, PayloadRecord } from "./types";
import { asRecord, displayValue, formatLabel } from "./utils";

const PREVIEW_LIMIT = 12;

function KeyValueList({ value, className }: { value: PayloadRecord; className?: string }) {
  return (
    <dl
      className={cn(
        "grid min-w-0 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-[minmax(7rem,0.35fr)_minmax(0,1fr)]",
        className,
      )}
    >
      {Object.entries(value).map(([key, fieldValue]) => (
        <div className="contents" key={key}>
          <dt className="min-w-0 truncate text-muted-foreground" title={key}>
            {formatLabel(key)}
          </dt>
          <dd className="min-w-0 font-mono text-foreground [overflow-wrap:anywhere]">
            {displayValue(fieldValue)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ShowMoreButton({
  expanded,
  hiddenCount,
  onToggle,
}: {
  expanded: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  return (
    <Button
      className="w-full rounded-none"
      onClick={onToggle}
      size="sm"
      type="button"
      variant="ghost"
    >
      {expanded ? "Show less" : `Show ${hiddenCount} more`}
    </Button>
  );
}

function HttpRequestSection({ request }: { request: PayloadRecord }) {
  const headers = asRecord(request.headers);
  const method = typeof request.method === "string" ? request.method.toUpperCase() : null;
  const url = typeof request.url === "string" ? request.url : null;
  const otherFields = Object.fromEntries(
    ["query_string", "fragment", "data", "cookies", "env"].flatMap((key) =>
      request[key] === undefined || request[key] === null || request[key] === ""
        ? []
        : [[key, request[key]]],
    ),
  );

  return (
    <CollapsibleSection
      bodyClassName="grid gap-3 p-4"
      summary={method && url ? `${method} ${url}` : undefined}
      title="HTTP request"
    >
      {url ? (
        <p className="flex min-w-0 items-baseline gap-2 font-mono text-xs">
          {method ? <Badge variant="muted">{method}</Badge> : null}
          <span className="min-w-0 text-foreground [overflow-wrap:anywhere]">{url}</span>
        </p>
      ) : null}
      {Object.keys(otherFields).length > 0 ? <KeyValueList value={otherFields} /> : null}
      {headers && Object.keys(headers).length > 0 ? (
        <details className="min-w-0 rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Headers ({Object.keys(headers).length})
          </summary>
          <KeyValueList className="mt-3" value={headers} />
        </details>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Request context captured by the SDK. In a browser this may be the current page; outgoing
        requests appear in the breadcrumbs.
      </p>
    </CollapsibleSection>
  );
}

function breadcrumbTime(value: unknown) {
  const seconds =
    typeof value === "number" ? value : typeof value === "string" ? Date.parse(value) / 1000 : NaN;
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
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

function BreadcrumbRow({ breadcrumb }: { breadcrumb: PayloadRecord }) {
  const [open, setOpen] = useState(false);
  const data = asRecord(breadcrumb.data);
  const status = Number(data?.status_code);
  const failed = status >= 400 || status === 0 || breadcrumb.level === "error";
  const category = displayValue(breadcrumb.category ?? breadcrumb.type ?? "event");
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
        <span className="font-mono tabular-nums text-muted-foreground">{time ?? "—"}</span>
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

function BreadcrumbsSection({ breadcrumbs }: { breadcrumbs: PayloadRecord[] }) {
  const [showAll, setShowAll] = useState(false);
  if (breadcrumbs.length === 0) return null;

  // Most recent activity first: the crumbs closest to the error matter most.
  const ordered = [...breadcrumbs].reverse();
  const visible = showAll ? ordered : ordered.slice(0, PREVIEW_LIMIT);

  return (
    <CollapsibleSection summary={`${breadcrumbs.length} · most recent first`} title="Breadcrumbs">
      <ol className="min-w-0">
        {visible.map((breadcrumb, index) => (
          <BreadcrumbRow breadcrumb={breadcrumb} key={index} />
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

function PackagesSection({ packages }: { packages: PackageEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  if (packages.length === 0) return null;

  const visible = showAll ? packages : packages.slice(0, PREVIEW_LIMIT);

  return (
    <CollapsibleSection defaultOpen={false} summary={String(packages.length)} title="Packages">
      <div className="grid min-w-0 sm:grid-cols-2">
        {visible.map((pkg) => (
          <div
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border px-4 py-1.5 font-mono text-xs"
            key={`${pkg.name}:${pkg.version}`}
          >
            <span className="min-w-0 truncate text-foreground" title={pkg.name}>
              {pkg.name}
            </span>
            <span className="text-muted-foreground">{pkg.version}</span>
          </div>
        ))}
      </div>
      {packages.length > PREVIEW_LIMIT ? (
        <ShowMoreButton
          expanded={showAll}
          hiddenCount={packages.length - PREVIEW_LIMIT}
          onToggle={() => setShowAll((current) => !current)}
        />
      ) : null}
    </CollapsibleSection>
  );
}

function TagsSection({ tags }: { tags: [string, unknown][] }) {
  if (tags.length === 0) return null;

  return (
    <CollapsibleSection bodyClassName="p-3" summary={String(tags.length)} title="Tags">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(([key, value]) => (
          <span
            className="inline-flex max-w-full overflow-hidden rounded-md border border-border font-mono text-xs"
            key={key}
          >
            <span className="shrink-0 bg-muted/60 px-2 py-0.5 text-muted-foreground">{key}</span>
            <span className="truncate px-2 py-0.5 text-foreground">{displayValue(value)}</span>
          </span>
        ))}
      </div>
    </CollapsibleSection>
  );
}

function RecordSection({
  title,
  value,
  defaultOpen = true,
}: {
  title: string;
  value: PayloadRecord | null;
  defaultOpen?: boolean;
}) {
  if (!value || Object.keys(value).length === 0) return null;
  return (
    <CollapsibleSection bodyClassName="p-4" defaultOpen={defaultOpen} title={title}>
      <KeyValueList value={value} />
    </CollapsibleSection>
  );
}

function ContextsSection({ contextEntries }: { contextEntries: [string, PayloadRecord][] }) {
  if (contextEntries.length === 0) return null;

  return (
    <CollapsibleSection
      bodyClassName="p-3"
      summary={contextEntries.map(([name]) => formatLabel(name)).join(", ")}
      title="Contexts"
    >
      {/* CSS columns balance cards of different heights without index-based splitting. */}
      <div className="gap-3 md:columns-2">
        {contextEntries.map(([name, values]) => (
          <div
            className="mb-3 min-w-0 break-inside-avoid rounded-md border border-border p-3"
            key={name}
          >
            <p className="mb-2 text-xs font-semibold capitalize text-foreground">
              {formatLabel(name)}
            </p>
            <KeyValueList value={values} />
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

export {
  BreadcrumbsSection,
  ContextsSection,
  HttpRequestSection,
  KeyValueList,
  PackagesSection,
  RecordSection,
  TagsSection,
};
