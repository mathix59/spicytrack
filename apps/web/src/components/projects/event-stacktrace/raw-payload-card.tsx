function RawPayloadCard({
  rawPayload,
  summary,
}: {
  rawPayload: Record<string, unknown>;
  summary: string;
}) {
  return (
    <details className="min-w-0 max-w-full rounded-lg border border-border bg-muted/20 p-4">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
        {summary}
      </summary>
      <pre className="mt-3 max-w-full overflow-x-auto rounded-md bg-muted/30 p-3 text-xs leading-6 text-foreground">
        {JSON.stringify(rawPayload, null, 2)}
      </pre>
    </details>
  );
}

export { RawPayloadCard };
