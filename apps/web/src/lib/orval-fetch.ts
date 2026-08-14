import { resolveApiBaseUrl } from "./api-base-url";

const API_BASE_URL = resolveApiBaseUrl();

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message || `HTTP ${status}`);
    this.status = status;
  }
}

export const orvalFetch = async <T>(
  url: string,
  options: RequestInit & {
    method?: string;
    params?: Record<string, unknown>;
    body?: BodyInit | Record<string, unknown> | null;
  },
): Promise<T> => {
  const target = new URL(`${API_BASE_URL}${url}`);

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === undefined || value === null) {
        continue;
      }

      target.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(options.headers);

  let body: BodyInit | null | undefined;
  if (
    options.body instanceof FormData ||
    typeof options.body === "string" ||
    options.body instanceof URLSearchParams ||
    options.body instanceof Blob ||
    options.body instanceof ArrayBuffer ||
    ArrayBuffer.isView(options.body)
  ) {
    body = options.body;
  } else if (options.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(target.toString(), {
    ...options,
    method: options.method ?? "GET",
    headers,
    body,
    credentials: "include",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new HttpError(response.status, message);
  }

  if (response.status === 204) {
    return {
      data: undefined,
      status: response.status,
      headers: response.headers,
    } as T;
  }

  const data = (await response.json()) as unknown;

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
};

export type ErrorType<Error> = Error;

export type BodyType<BodyData> = BodyData;
