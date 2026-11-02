import { memo } from "react";
import { Highlight } from "prism-react-renderer";

import { codeTheme } from "@/lib/code-theme";
import { cn } from "@/lib/utils";

import type { StackFrame } from "./types";
import { languageForFilename } from "./utils";

/**
 * Source context around a frame. The whole snippet is tokenized at once so multi-line
 * constructs (template literals, block comments) highlight correctly.
 */
const FrameSource = memo(function FrameSource({ frame }: { frame: StackFrame }) {
  const lines = [...frame.preContext, frame.contextLine ?? "", ...frame.postContext];
  const firstLine = frame.lineno - frame.preContext.length;
  const errorIndex = frame.preContext.length;

  return (
    <Highlight
      code={lines.join("\n")}
      language={languageForFilename(frame.filename)}
      theme={codeTheme}
    >
      {({ tokens, getTokenProps }) => (
        <pre className="overflow-x-auto bg-background/60 py-1 font-mono text-[12.5px] leading-6">
          {tokens.map((line, index) => {
            const highlighted = index === errorIndex;
            return (
              <div
                className={cn(
                  "flex min-w-fit",
                  highlighted && "border-l-2 border-l-destructive bg-destructive/10",
                  !highlighted && "border-l-2 border-l-transparent",
                )}
                key={index}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "sticky left-0 w-12 shrink-0 select-none bg-inherit px-3 text-right text-muted-foreground",
                    highlighted && "text-destructive",
                  )}
                >
                  {firstLine + index}
                </span>
                <code className="whitespace-pre pr-4">
                  {line.map((token, tokenIndex) => (
                    <span key={tokenIndex} {...getTokenProps({ token })} />
                  ))}
                </code>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
});

export { FrameSource };
