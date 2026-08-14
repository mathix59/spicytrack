import { getErrorMessage } from "@/lib/utils";

async function runAsyncFormAction<Result>({
  setError,
  action,
  onSuccess,
}: {
  setError: (value: string | null) => void;
  action: () => Promise<Result>;
  onSuccess?: (result: Result) => void | Promise<void>;
}) {
  setError(null);

  try {
    const result = await action();
    await onSuccess?.(result);
    return result;
  } catch (error) {
    setError(getErrorMessage(error));
    return null;
  }
}

export { runAsyncFormAction };
