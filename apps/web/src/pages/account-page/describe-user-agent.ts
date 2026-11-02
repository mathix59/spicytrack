const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone|iPad/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

/** Best-effort, human readable "Browser on OS" label for a session's user agent. */
function describeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return { label: "Unknown device", mobile: false };
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const mobile = /Mobile|iPhone|Android/.test(userAgent);
  const label =
    browser && system ? `${browser} on ${system}` : (browser ?? system ?? "Unknown device");
  return { label, mobile };
}

export { describeUserAgent };
