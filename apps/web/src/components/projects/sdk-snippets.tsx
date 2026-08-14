import { useState } from "react";
import { Copy } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";

import { Button } from "@/components/ui/button";

function CopyableCode({
  label,
  value,
  language,
}: {
  label: string;
  value: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button onClick={() => void copy()} size="sm" type="button" variant="ghost">
          <Copy className="size-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {language ? (
        <Highlight code={value} language={language} theme={themes.oneDark}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre
              aria-label={`${label} code`}
              className="overflow-x-auto rounded-lg bg-muted/30 px-3 py-2 text-[11px]"
              tabIndex={0}
            >
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
          className="overflow-x-auto rounded-lg bg-muted/30 px-3 py-2 text-[11px] text-foreground"
          tabIndex={0}
        >
          <code>{value}</code>
        </pre>
      )}
    </div>
  );
}

export { CopyableCode };
