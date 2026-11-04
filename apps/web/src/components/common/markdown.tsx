import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A small Markdown renderer for AI-written text (Autofix analyses, triage briefings). It builds
 * React elements only, so raw HTML in the source is shown as text and never interpreted.
 * Supports headings, paragraphs, bold, italic, inline code, fenced code blocks, ordered and
 * unordered lists, blockquotes and http(s)/mailto links.
 */

type Block =
  | { type: "heading"; depth: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code"; language: string | null; text: string }
  | { type: "list"; ordered: boolean; start: number; items: string[] }
  | { type: "blockquote"; blocks: Block[] };

const FENCE = /^\s{0,3}(```|~~~)\s*([\w+-]*)\s*$/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const UNORDERED_ITEM = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED_ITEM = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/;
const BLOCKQUOTE = /^\s{0,3}>\s?(.*)$/;
const CONTINUATION = /^\s{2,}\S/;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

function isBlockStart(line: string) {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    UNORDERED_ITEM.test(line) ||
    ORDERED_ITEM.test(line) ||
    BLOCKQUOTE.test(line)
  );
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const body: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== marker) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence, or the end of the text
      blocks.push({ type: "code", language: fence[2] || null, text: body.join("\n") });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: "heading", depth: heading[1].length, text: heading[2] });
      index += 1;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length) {
        const match = BLOCKQUOTE.exec(lines[index]);
        if (!match) break;
        quoted.push(match[1]);
        index += 1;
      }
      blocks.push({ type: "blockquote", blocks: parseBlocks(quoted) });
      continue;
    }

    const ordered = ORDERED_ITEM.exec(line);
    if (ordered || UNORDERED_ITEM.test(line)) {
      const pattern = ordered ? ORDERED_ITEM : UNORDERED_ITEM;
      const items: string[] = [];
      while (index < lines.length) {
        const match = pattern.exec(lines[index]);
        if (match) {
          items.push(match[ordered ? 2 : 1]);
          index += 1;
        } else if (items.length > 0 && CONTINUATION.test(lines[index])) {
          items[items.length - 1] += ` ${lines[index].trim()}`;
          index += 1;
        } else if (
          lines[index].trim() === "" &&
          index + 1 < lines.length &&
          pattern.test(lines[index + 1])
        ) {
          index += 1; // a loose list: blank lines between items
        } else {
          break;
        }
      }
      blocks.push({
        type: "list",
        ordered: Boolean(ordered),
        start: ordered ? Number(ordered[1]) : 1,
        items,
      });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraph.join(" ") });
  }

  return blocks;
}

/** Inline syntax, tried in order at each position: code, links, bold, italic. */
const INLINE =
  /(`+)([\s\S]*?[^`])\1(?!`)|\[([^\]]+)\]\(\s*<?([^\s<>)]+)>?(?:\s+"[^"]*")?\s*\)|(?<![\w*])(\*\*|__)(?=\S)([\s\S]*?\S)\5(?![\w*])|(?<![\w*])(\*|_)(?=\S)([\s\S]*?\S)\7(?![\w*])|<((?:https?:\/\/|mailto:)[^\s<>]+)>/g;

function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let count = 0;
  INLINE.lastIndex = 0;

  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(text.slice(last, start));
    const key = `${keyPrefix}-${count++}`;
    const [, , code, label, href, , strong, , emphasis, autolink] = match;

    if (code !== undefined) {
      nodes.push(
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]" key={key}>
          {code.trim() === "" ? code : code.replace(/^ (.*) $/, "$1")}
        </code>,
      );
    } else if (label !== undefined) {
      nodes.push(renderLink(href, renderInline(label, key), key, match[0]));
    } else if (strong !== undefined) {
      nodes.push(
        <strong className="font-semibold text-foreground" key={key}>
          {renderInline(strong, key)}
        </strong>,
      );
    } else if (emphasis !== undefined) {
      nodes.push(<em key={key}>{renderInline(emphasis, key)}</em>);
    } else if (autolink !== undefined) {
      nodes.push(renderLink(autolink, autolink, key, match[0]));
    }
    last = start + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Only http(s) and mailto links become anchors; anything else stays plain text. */
function renderLink(href: string, children: ReactNode, key: string, source: string) {
  if (!SAFE_LINK.test(href)) {
    return <Fragment key={key}>{source}</Fragment>;
  }
  return (
    <a
      className="font-medium text-primary-accent underline underline-offset-2 [overflow-wrap:anywhere]"
      href={href}
      key={key}
      rel="noreferrer noopener"
      target="_blank"
    >
      {children}
    </a>
  );
}

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function minHeadingDepth(blocks: Block[]): number {
  let depth = 6;
  for (const block of blocks) {
    if (block.type === "heading") depth = Math.min(depth, block.depth);
    if (block.type === "blockquote") depth = Math.min(depth, minHeadingDepth(block.blocks));
  }
  return depth;
}

function renderBlocks(blocks: Block[], headingOffset: number, keyPrefix: string): ReactNode[] {
  return blocks.map((block, position) => {
    const key = `${keyPrefix}-${position}`;
    switch (block.type) {
      case "heading": {
        const Tag = HEADING_TAGS[Math.min(5, Math.max(0, block.depth + headingOffset - 1))];
        return (
          <Tag className="font-semibold text-foreground" key={key}>
            {renderInline(block.text, key)}
          </Tag>
        );
      }
      case "paragraph":
        return <p key={key}>{renderInline(block.text, key)}</p>;
      case "code":
        return (
          <pre
            className="max-w-full overflow-x-auto rounded-md bg-muted/60 p-2 font-mono text-[0.85em] leading-5"
            key={key}
          >
            <code data-language={block.language ?? undefined}>{block.text}</code>
          </pre>
        );
      case "list": {
        const items = block.items.map((item, itemIndex) => (
          <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
        ));
        return block.ordered ? (
          <ol
            className="list-decimal space-y-1 pl-5"
            key={key}
            start={block.start === 1 ? undefined : block.start}
          >
            {items}
          </ol>
        ) : (
          <ul className="list-disc space-y-1 pl-5" key={key}>
            {items}
          </ul>
        );
      }
      case "blockquote":
        return (
          <blockquote className="grid gap-2 border-l-2 border-border pl-3 italic" key={key}>
            {renderBlocks(block.blocks, headingOffset, key)}
          </blockquote>
        );
    }
  });
}

function Markdown({
  source,
  className,
  headingLevel = 3,
}: {
  source: string;
  className?: string;
  /** HTML level of the text's top-most heading, so it fits the page outline. */
  headingLevel?: number;
}) {
  const blocks = parseBlocks(source.replace(/\r\n?/g, "\n").split("\n"));
  const headingOffset = headingLevel - minHeadingDepth(blocks);

  return (
    <div className={cn("grid min-w-0 gap-2 [overflow-wrap:anywhere]", className)}>
      {renderBlocks(blocks, headingOffset, "md")}
    </div>
  );
}

export { Markdown };
