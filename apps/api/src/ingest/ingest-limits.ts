const DEFAULT_MAX_EVENT_BYTES = 1_000_000;
const DEFAULT_PROJECT_EVENTS_PER_HOUR = 10_000;
const DEFAULT_ORGANIZATION_EVENTS_PER_HOUR = 50_000;

function nonNegativeInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const value = nonNegativeInteger(name, fallback);
  if (value === 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function ingestLimits() {
  return {
    maxEventBytes: positiveInteger("INGEST_MAX_EVENT_BYTES", DEFAULT_MAX_EVENT_BYTES),
    projectEventsPerHour: nonNegativeInteger(
      "INGEST_PROJECT_EVENTS_PER_HOUR",
      DEFAULT_PROJECT_EVENTS_PER_HOUR,
    ),
    organizationEventsPerHour: nonNegativeInteger(
      "INGEST_ORGANIZATION_EVENTS_PER_HOUR",
      DEFAULT_ORGANIZATION_EVENTS_PER_HOUR,
    ),
  };
}

export { ingestLimits };
