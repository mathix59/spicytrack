type HealthVariant = "success" | "warning" | "danger" | "muted";

/** "99.42%", keeping two decimals below 100% so a few crashes stay visible. */
function formatRate(rate: number | null | undefined) {
  if (rate === null || rate === undefined) return "—";
  if (rate >= 1) return "100%";
  return `${(Math.floor(rate * 10_000) / 100).toFixed(2)}%`;
}

function healthVariant(rate: number | null | undefined): HealthVariant {
  if (rate === null || rate === undefined) return "muted";
  if (rate >= 0.99) return "success";
  if (rate >= 0.95) return "warning";
  return "danger";
}

export { formatRate, healthVariant };
