import type { ContextSummaryItem, PackageEntry, PayloadRecord } from "./types";

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PayloadRecord)
    : null;
}

function toBreadcrumbs(value: unknown): PayloadRecord[] {
  const values = Array.isArray(value) ? value : asRecord(value)?.values;
  return Array.isArray(values)
    ? values.flatMap((item) => {
        const record = asRecord(item);
        return record ? [record] : [];
      })
    : [];
}

function toEntries(value: unknown): [string, unknown][] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      Array.isArray(entry) && typeof entry[0] === "string" ? [[entry[0], entry[1]]] : [],
    );
  }

  return Object.entries(asRecord(value) ?? {});
}

function toContextEntries(value: PayloadRecord | null): [string, PayloadRecord][] {
  return Object.entries(value ?? {}).flatMap(([name, context]) => {
    const values = asRecord(context);
    return values && Object.keys(values).length > 0 ? [[name, values]] : [];
  });
}

function toPackages(...sources: unknown[]): PackageEntry[] {
  const packages = new Map<string, string>();

  for (const source of sources) {
    const moduleMap = asRecord(source);
    if (moduleMap) {
      Object.entries(moduleMap).forEach(([name, version]) => {
        if (typeof version === "string") {
          packages.set(name, version);
        }
      });
      continue;
    }

    if (Array.isArray(source)) {
      source.forEach((item) => {
        const pkg = asRecord(item);
        if (typeof pkg?.name === "string" && typeof pkg.version === "string") {
          packages.set(pkg.name, pkg.version);
        }
      });
    }
  }

  return [...packages]
    .map(([name, version]) => ({ name, version }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

function text(value: unknown) {
  if (typeof value === "number") return String(value);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function joinText(...values: unknown[]) {
  const parts = values.map(text).filter((part) => part !== null);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** "Chrome 120" from a context with a name; a bare version says nothing on its own. */
function nameAndVersion(context: PayloadRecord | null) {
  return text(context?.name) ? joinText(context?.name, context?.version) : text(context?.raw);
}

/**
 * The few context values that identify where an event happened (browser, OS, runtime, device,
 * user), for a one-line summary above the stack trace. Absent values are left out.
 */
function toContextSummary(rawPayload: PayloadRecord): ContextSummaryItem[] {
  const contexts = asRecord(rawPayload.contexts);
  const context = (name: string) => asRecord(contexts?.[name]);
  const browser = context("browser");
  const os = context("os") ?? context("client_os");
  const runtime = context("runtime");
  const device = context("device");
  const user = asRecord(rawPayload.user);

  const items: [string, string | null][] = [
    ["Browser", nameAndVersion(browser)],
    ["OS", nameAndVersion(os)],
    ["Runtime", nameAndVersion(runtime)],
    ["Device", joinText(device?.brand, device?.model ?? device?.name ?? device?.family)],
    ["User", text(user?.email) ?? text(user?.username) ?? text(user?.id) ?? text(user?.ip_address)],
  ];
  return items.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

function omit(value: PayloadRecord, ...keys: string[]) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
}

function displayValue(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export {
  asRecord,
  displayValue,
  formatLabel,
  omit,
  toBreadcrumbs,
  toContextEntries,
  toContextSummary,
  toEntries,
  toPackages,
};
