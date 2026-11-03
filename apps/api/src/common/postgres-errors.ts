const UNIQUE_VIOLATION = "23505";

/**
 * True when the error, or one of its causes (drizzle wraps driver errors), is a unique-index
 * violation, optionally on a given constraint.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let current: unknown = error;
  const visited = new Set<unknown>();
  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if (
      "code" in current &&
      current.code === UNIQUE_VIOLATION &&
      (constraint === undefined || ("constraint" in current && current.constraint === constraint))
    ) {
      return true;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
