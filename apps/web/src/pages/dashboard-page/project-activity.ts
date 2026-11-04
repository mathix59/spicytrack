/** Busiest first: events in the last 24 hours, then open issues, then name. */
function compareProjectActivity(
  a: { name: string; eventCount24h: number; openIssueCount: number },
  b: { name: string; eventCount24h: number; openIssueCount: number },
) {
  return (
    b.eventCount24h - a.eventCount24h ||
    b.openIssueCount - a.openIssueCount ||
    a.name.localeCompare(b.name)
  );
}

export { compareProjectActivity };
