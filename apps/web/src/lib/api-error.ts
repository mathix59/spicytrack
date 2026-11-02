import { getErrorMessage } from "@/lib/utils";

/**
 * Turns a failed API call into a readable message. `orvalFetch` throws the raw response body,
 * which is usually a JSON payload with a `message` field.
 */
function readApiErrorMessage(error: unknown) {
  const message = getErrorMessage(error);
  try {
    const payload: unknown = JSON.parse(message);
    if (payload && typeof payload === "object" && "message" in payload) {
      const value = payload.message;
      if (typeof value === "string" && value) return value;
      if (Array.isArray(value) && value.length) return value.map(String).join(" ");
    }
  } catch {
    // Not JSON: the raw message is already human readable.
  }
  return message;
}

/** Runs an API call and rethrows failures as an `Error` carrying a readable message. */
async function withReadableApiError<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    const status = (error as { status?: number } | null)?.status;
    throw Object.assign(new Error(readApiErrorMessage(error), { cause: error }), { status });
  }
}

export { readApiErrorMessage, withReadableApiError };
