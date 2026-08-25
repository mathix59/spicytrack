const DEFAULT_WEB_ORIGIN = "http://localhost:5174";

const LOOPBACK_HOST_ALIASES: Record<string, string[]> = {
  localhost: ["127.0.0.1", "[::1]"],
  "127.0.0.1": ["localhost", "[::1]"],
  "[::1]": ["localhost", "127.0.0.1"],
};

function loopbackAliases(origin: string): string[] {
  try {
    const url = new URL(origin);
    const aliases = LOOPBACK_HOST_ALIASES[url.hostname];

    if (!aliases) {
      return [];
    }

    return aliases.map((hostname) => {
      const port = url.port ? `:${url.port}` : "";
      return `${url.protocol}//${hostname}${port}`;
    });
  } catch {
    return [];
  }
}

export function webOrigins(): string[] {
  const configured = (process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN)
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (process.env.NODE_ENV === "production") {
    return [...new Set(configured)];
  }

  return [...new Set(configured.flatMap((origin) => [origin, ...loopbackAliases(origin)]))];
}
