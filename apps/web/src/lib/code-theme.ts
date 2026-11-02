import type { PrismTheme } from "prism-react-renderer";

/**
 * Syntax colours resolve from `--code-*` CSS variables, so a single theme object follows the
 * light/dark palette without re-rendering highlighted code when the theme changes.
 */
const codeTheme: PrismTheme = {
  plain: { color: "var(--code-foreground)" },
  styles: [
    {
      types: ["comment", "prolog", "doctype", "cdata"],
      style: { color: "var(--code-comment)", fontStyle: "italic" },
    },
    { types: ["punctuation", "operator"], style: { color: "var(--code-punctuation)" } },
    {
      types: ["keyword", "atrule", "important", "selector", "deleted"],
      style: { color: "var(--code-keyword)" },
    },
    {
      types: ["string", "char", "attr-value", "regex", "url", "inserted"],
      style: { color: "var(--code-string)" },
    },
    {
      types: ["function", "function-variable", "method"],
      style: { color: "var(--code-function)" },
    },
    { types: ["number", "boolean", "constant", "symbol"], style: { color: "var(--code-number)" } },
    {
      types: ["class-name", "builtin", "tag", "maybe-class-name"],
      style: { color: "var(--code-type)" },
    },
    {
      types: ["property", "attr-name", "variable", "parameter"],
      style: { color: "var(--code-property)" },
    },
  ],
};

export { codeTheme };
