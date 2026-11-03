import { resolveApiBaseUrl } from "./api-base-url";
import { HttpError } from "./orval-fetch";

const API_BASE_URL = resolveApiBaseUrl();

/** Saves an in-memory file through a temporary link. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function fileNameFrom(disposition: string | null, fallback: string) {
  return disposition?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

/** Downloads a non-JSON API response (CSV, JSON attachment…) with the session cookie. */
async function downloadApiFile(
  path: string,
  params: Record<string, string | undefined>,
  fallbackName: string,
) {
  const target = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) target.searchParams.set(key, value);
  }
  const response = await fetch(target, { credentials: "include" });
  if (!response.ok) throw new HttpError(response.status, await response.text());
  saveBlob(
    await response.blob(),
    fileNameFrom(response.headers.get("Content-Disposition"), fallbackName),
  );
  return { truncated: response.headers.get("X-SpicyTrack-Export-Truncated") === "true" };
}

export { downloadApiFile, saveBlob };
