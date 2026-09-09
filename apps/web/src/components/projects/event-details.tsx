import { useState } from "react";

import {
  BreadcrumbsSection,
  ContextsSection,
  DetailsSection,
  HttpRequestSection,
  KeyValueList,
  PackagesSection,
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

function EventDetails({ rawPayload }: { rawPayload: PayloadRecord }) {
  const request = asRecord(rawPayload.request);
  const breadcrumbs = toBreadcrumbs(rawPayload.breadcrumbs);
  const extra = asRecord(rawPayload.extra);
  const tags = toEntries(rawPayload.tags);
  const contexts = asRecord(rawPayload.contexts);
  const user = asRecord(rawPayload.user);
  const sdk = asRecord(rawPayload.sdk);
  const packages = toPackages(rawPayload.modules, sdk?.packages);
  const sdkMetadata = sdk ? omit(sdk, "packages", "integrations") : null;
  const contextEntries = toContextEntries(contexts);
  const [showAllPackages, setShowAllPackages] = useState(false);

  if (
    !request &&
    breadcrumbs.length === 0 &&
    !extra &&
    tags.length === 0 &&
    !contexts &&
    !user &&
    !sdk
  ) {
    return null;
  }

  return (
    <div className="grid min-w-0 gap-3">
      {request ? <HttpRequestSection request={request} /> : null}
      <BreadcrumbsSection breadcrumbs={breadcrumbs} />
      {extra && Object.keys(extra).length > 0 ? (
        <DetailsSection title="Additional data">
          <KeyValueList value={extra} />
        </DetailsSection>
      ) : null}

      {sdkMetadata && Object.keys(sdkMetadata).length > 0 ? (
        <DetailsSection title="SDK">
          <KeyValueList value={sdkMetadata} />
        </DetailsSection>
      ) : null}

      <PackagesSection
        onToggle={() => setShowAllPackages((current) => !current)}
        packages={packages}
        showAllPackages={showAllPackages}
      />

      <TagsSection tags={tags} />

      {user && Object.keys(user).length > 0 ? (
        <DetailsSection title="User">
          <KeyValueList value={user} />
        </DetailsSection>
      ) : null}

      <ContextsSection contextEntries={contextEntries} />
    </div>
  );
}

export { EventDetails };
