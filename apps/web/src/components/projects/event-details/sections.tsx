import { useState } from "react";

import { CollapsibleSection } from "@/components/common/collapsible-section";
import { Badge } from "@/components/ui/badge";

import { BreadcrumbsSection } from "./breadcrumbs-section";
import { KeyValueList, PREVIEW_LIMIT, ShowMoreButton } from "./key-value-list";
import type { ContextSummaryItem, PackageEntry, PayloadRecord } from "./types";
import { asRecord, displayValue, formatLabel } from "./utils";

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

function ContextSummary({ items }: { items: ContextSummaryItem[] }) {
  if (items.length === 0) return null;

  return (
    <ul aria-label="Event context" className="flex min-w-0 flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          className="inline-flex min-w-0 max-w-full items-baseline gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs"
          key={item.label}
        >
          <span className="shrink-0 text-muted-foreground">{item.label}</span>
          <span className="min-w-0 truncate font-medium text-foreground" title={item.value}>
            {item.value}
          </span>
        </li>
      ))}
    </ul>
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
  ContextSummary,
  ContextsSection,
  HttpRequestSection,
  KeyValueList,
  PackagesSection,
  RecordSection,
  TagsSection,
};
