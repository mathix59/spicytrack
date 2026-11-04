/**
 * Exception titles ("TypeError: Cannot read…") read better as a type eyebrow over the message.
 * The heading's accessible name stays the full title, since the split is only visual.
 */
function IssueTitle({ title }: { title: string }) {
  const match =
    /^([A-Za-z_$][\w$.]*(?:Error|Exception|Warning|Fault|Panic|Rejection)):\s+([\s\S]+)$/.exec(
      title,
    );
  const type = match && match[1].length <= 80 ? match[1] : null;

  return (
    <h1 aria-label={title} className="grid min-w-0 gap-1 [overflow-wrap:anywhere]" title={title}>
      {type && match ? (
        <>
          <span aria-hidden="true" className="font-mono text-sm font-medium text-primary-accent">
            {type}
          </span>
          <span
            aria-hidden="true"
            className="line-clamp-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl"
          >
            {match[2]}
          </span>
        </>
      ) : (
        <span className="line-clamp-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {title}
        </span>
      )}
    </h1>
  );
}

export { IssueTitle };
