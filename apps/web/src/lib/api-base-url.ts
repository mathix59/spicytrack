const DEFAULT_API_BASE_URL = "http://localhost:3002/api";

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getBrowserOrigin() {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  return "http://localhost:3002";
}

export function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL;

  if (!configured) {
    return DEFAULT_API_BASE_URL;
  }

  if (/^https?:\/\//i.test(configured)) {
    return normalizeBaseUrl(configured);
  }

  return normalizeBaseUrl(new URL(configured, getBrowserOrigin()).toString());
}
