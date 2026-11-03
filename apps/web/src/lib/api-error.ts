import { getErrorMessage } from "@/lib/utils";

/** Readable message of a failed API call; see `getErrorMessage`. */
const readApiErrorMessage = getErrorMessage;

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
