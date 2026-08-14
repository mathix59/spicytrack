import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { PackageEntry, PayloadRecord } from "./types";
import { asRecord, displayValue, formatLabel } from "./utils";

function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-muted/20 p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function KeyValueList({ value }: { value: PayloadRecord }) {
  return (
    <dl className="grid min-w-0 gap-x-4 gap-y-2 text-xs sm:grid-cols-[minmax(8rem,0.4fr)_minmax(0,1fr)]">
      {Object.entries(value).map(([key, fieldValue]) => (
        <div className="contents" key={key}>
          <dt className="min-w-0 text-muted-foreground">{formatLabel(key)}</dt>
          <dd className="min-w-0 break-words font-mono text-foreground">
            {displayValue(fieldValue)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function HttpRequestSection({ request }: { request: PayloadRecord }) {
  const headers = asRecord(request.headers);
  const mainFields = Object.fromEntries(
    ["method", "url", "query_string", "fragment"].flatMap((key) =>
      request[key] === undefined ? [] : [[key, request[key]]],
    ),
  );

  return (
    <DetailsSection title="HTTP Request">
      <KeyValueList value={mainFields} />
      {headers && Object.keys(headers).length > 0 ? (
        <details className="mt-3 min-w-0 rounded-md border border-border bg-muted/20 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Headers ({Object.keys(headers).length})
          </summary>
          <div className="mt-3">
            <KeyValueList value={headers} />
          </div>
        </details>
      ) : null}
    </DetailsSection>
  );
}

function PackagesSection({
  packages,
  showAllPackages,
  onToggle,
}: {
  packages: PackageEntry[];
  showAllPackages: boolean;
  onToggle: () => void;
}) {
  const visiblePackages = showAllPackages ? packages : packages.slice(0, 16);

  if (packages.length === 0) {
    return null;
  }

  return (
    <DetailsSection title={`Packages (${packages.length})`}>
      <div className="min-w-0 rounded-md border border-border">
        {visiblePackages.map((pkg) => (
          <div
            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border px-3 py-2 text-xs last:border-b-0"
            key={`${pkg.name}:${pkg.version}`}
          >
            <span className="min-w-0 break-all font-mono text-foreground">{pkg.name}</span>
            <span className="font-mono text-muted-foreground">{pkg.version}</span>
          </div>
        ))}
      </div>
      {packages.length > 16 ? (
        <Button className="mt-3" onClick={onToggle} size="sm" type="button" variant="ghost">
          {showAllPackages ? "Voir moins" : `Voir plus (${packages.length - 16})`}
        </Button>
      ) : null}
    </DetailsSection>
  );
}

function TagsSection({ tags }: { tags: [string, unknown][] }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <DetailsSection title="Tags">
      <div className="flex flex-wrap gap-2">
        {tags.map(([key, value]) => (
          <Badge className="max-w-full gap-1 font-normal" key={key} variant="muted">
            <span className="shrink-0 text-muted-foreground">{key}</span>
            <span className="truncate text-foreground">{displayValue(value)}</span>
          </Badge>
        ))}
      </div>
    </DetailsSection>
  );
}

function ContextCard({ name, values }: { name: string; values: PayloadRecord }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 p-3">
      <p className="mb-2 text-xs font-medium text-foreground">{formatLabel(name)}</p>
      <KeyValueList value={values} />
    </div>
  );
}

function ContextsSection({ contextEntries }: { contextEntries: [string, PayloadRecord][] }) {
  if (contextEntries.length === 0) {
    return null;
  }

  const leftColumn = contextEntries.filter((_, index) => index % 2 === 0);
  const rightColumn = contextEntries.filter((_, index) => index % 2 === 1);

  return (
    <DetailsSection title="Contexts">
      <div className="grid items-start gap-3 md:grid-cols-2">
        <div className="grid content-start gap-3">
          {leftColumn.map(([name, values]) => (
            <ContextCard key={name} name={name} values={values} />
          ))}
        </div>
        <div className="grid content-start gap-3">
          {rightColumn.map(([name, values]) => (
            <ContextCard key={name} name={name} values={values} />
          ))}
        </div>
      </div>
    </DetailsSection>
  );
}

export {
  ContextsSection,
  DetailsSection,
  HttpRequestSection,
  KeyValueList,
  PackagesSection,
  TagsSection,
};
