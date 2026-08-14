const SENSITIVE_KEY_PATTERN =
  /^(?:authorization|cookie|set-cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|session|credential)s?$/i;

const SENSITIVE_QUERY_PARAMETER_PATTERN =
  /([?&]|^)([^=&]*(?:token|secret|password|api[-_]?key|session|credential)[^=&]*)=([^&\s]*)/gi;

const FILTERED = "[Filtered]";

export function redactEventPayload(payload: Record<string, unknown>) {
  return redactValue(payload, [] as string[]) as Record<string, unknown>;
}

function redactValue(value: unknown, path: string[]): unknown {
  const key = path.at(-1);
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return FILTERED;
  }

  if (path.join(".") === "request.data") {
    return FILTERED;
  }

  if (typeof value === "string") {
    return redactQueryParameters(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, path));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, [...path, childKey]),
      ]),
    );
  }

  return value;
}

function redactQueryParameters(value: string) {
  return value.replace(
    SENSITIVE_QUERY_PARAMETER_PATTERN,
    (_match, prefix: string, key: string) => `${prefix}${key}=${FILTERED}`,
  );
}
