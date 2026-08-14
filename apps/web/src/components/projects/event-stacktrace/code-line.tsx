import { Highlight, themes } from "prism-react-renderer";

import { cn } from "@/lib/utils";

function CodeLine({
  lineno,
  text,
  highlighted,
}: {
  lineno: number;
  text: string;
  highlighted?: boolean;
}) {
  return (
    <div className={cn("flex", highlighted && "border-l-2 border-l-destructive bg-destructive/10")}>
      <span
        className={cn(
          "w-12 shrink-0 select-none px-3 text-right text-muted-foreground/60",
          highlighted && "text-destructive",
        )}
      >
        {lineno}
      </span>
      <span className="whitespace-pre pr-4 text-foreground">
        <Highlight code={text || " "} language="tsx" theme={themes.oneDark}>
          {({ tokens, getTokenProps }) =>
            tokens[0]?.map((token, tokenIndex) => (
              <span key={tokenIndex} {...getTokenProps({ token })} />
            ))
          }
        </Highlight>
      </span>
    </div>
  );
}

export { CodeLine };
