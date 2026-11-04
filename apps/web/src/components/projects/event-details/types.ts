type PayloadRecord = Record<string, unknown>;

type PackageEntry = {
  name: string;
  version: string;
};

type ContextSummaryItem = {
  label: string;
  value: string;
};

export type { ContextSummaryItem, PackageEntry, PayloadRecord };
