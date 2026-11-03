import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function renderNullableText(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/** The `message` of an API error body such as `{"message":"…","statusCode":400}`. */
function apiPayloadMessage(text: string) {
  if (!text.startsWith("{")) return null;
  try {
    const payload: unknown = JSON.parse(text);
    if (payload && typeof payload === "object" && "message" in payload) {
      const value = payload.message;
      if (typeof value === "string" && value) return value;
      if (Array.isArray(value) && value.length) return value.map(String).join(" ");
    }
  } catch {
    // Not JSON: the raw message is already human readable.
  }
  return null;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    // `orvalFetch` throws the raw response body, usually a JSON payload with a `message` field.
    return apiPayloadMessage(error.message) ?? error.message;
  }

  return "An unknown error occurred";
}

export function formatLocalDateTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatLocalDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
];

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelativeTime(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const absDiffMs = Math.abs(diffMs);

  if (absDiffMs < 60_000) {
    return "just now";
  }

  for (const [unit, unitMs] of RELATIVE_UNITS) {
    if (absDiffMs >= unitMs) {
      return relativeFormatter.format(Math.round(diffMs / unitMs), unit);
    }
  }

  return relativeFormatter.format(Math.round(diffMs / 60_000), "minute");
}
