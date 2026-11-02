import { Highlight, themes } from "prism-react-renderer";

import { CopyButton } from "@/components/ui/copy-button";

const PRE_CLASS_NAME =
  "overflow-x-auto rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-5";

/** Labelled code block with a copy action; highlights the code when a language is given. */
function CopyableCode({
  label,
  value,
  language,
}: {
  label: string;
  value: string;
  language?: string;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <CopyButton label={`Copy ${label}`} successMessage={`${label} copied`} value={value} />
      </div>
      {language ? (
        <Highlight code={value} language={language} theme={themes.oneDark}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre aria-label={`${label} code`} className={PRE_CLASS_NAME} tabIndex={0}>
              <code>
                {tokens.map((line, lineIndex) => (
                  <div key={lineIndex} {...getLineProps({ line })}>
                    {line.map((token, tokenIndex) => (
                      <span key={tokenIndex} {...getTokenProps({ token })} />
                    ))}
                  </div>
                ))}
              </code>
            </pre>
          )}
        </Highlight>
      ) : (
        <pre
          aria-label={`${label} code`}
          className={`${PRE_CLASS_NAME} text-foreground`}
          tabIndex={0}
        >
          <code>{value}</code>
        </pre>
      )}
    </div>
  );
}

export { CopyableCode };
