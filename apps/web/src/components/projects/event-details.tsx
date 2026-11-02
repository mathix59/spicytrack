import {
  BreadcrumbsSection,
  ContextsSection,
  HttpRequestSection,
  PackagesSection,
  RecordSection,
  TagsSection,
} from "./event-details/sections";
import type { PayloadRecord } from "./event-details/types";
import {
  asRecord,
  omit,
  toBreadcrumbs,
  toContextEntries,
  toEntries,
  toPackages,
} from "./event-details/utils";

/** Event context sections that follow the stack trace, ordered by diagnostic value. */
function EventDetails({ rawPayload }: { rawPayload: PayloadRecord }) {
  const request = asRecord(rawPayload.request);
  const breadcrumbs = toBreadcrumbs(rawPayload.breadcrumbs);
  const sdk = asRecord(rawPayload.sdk);
  const packages = toPackages(rawPayload.modules, sdk?.packages);

  return (
    <>
      <BreadcrumbsSection breadcrumbs={breadcrumbs} />
      {request ? <HttpRequestSection request={request} /> : null}
      <RecordSection title="User" value={asRecord(rawPayload.user)} />
      <ContextsSection contextEntries={toContextEntries(asRecord(rawPayload.contexts))} />
      <RecordSection title="Additional data" value={asRecord(rawPayload.extra)} />
      <PackagesSection packages={packages} />
      <RecordSection
        defaultOpen={false}
        title="SDK"
        value={sdk ? omit(sdk, "packages", "integrations") : null}
      />
    </>
  );
}

/** Tag chips shown above the stack trace, where they help triage at a glance. */
function EventTags({ rawPayload }: { rawPayload: PayloadRecord }) {
  return <TagsSection tags={toEntries(rawPayload.tags)} />;
}

export { EventDetails, EventTags };
