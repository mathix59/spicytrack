import type { PackageEntry, PayloadRecord } from "./types";

function asRecord(value: unknown): PayloadRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as PayloadRecord)
    : null;
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

export { asRecord, displayValue, formatLabel, omit, toContextEntries, toEntries, toPackages };
