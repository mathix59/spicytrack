// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

afterEach(() => cleanup());

function renderMarkdown(source: string, headingLevel?: number) {
  return render(<Markdown headingLevel={headingLevel} source={source} />).container;
}

describe("Markdown", () => {
  it("renders headings relative to the requested level, keeping their order", () => {
    const container = renderMarkdown("## Root cause\n\ntext\n\n### Details\n\nmore", 3);

    expect(screen.getByRole("heading", { level: 3, name: "Root cause" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "Details" })).toBeTruthy();
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("joins wrapped lines into one paragraph and splits on blank lines", () => {
    const container = renderMarkdown("first line\nsame paragraph\n\nsecond paragraph");

    const paragraphs = [...container.querySelectorAll("p")].map((node) => node.textContent);
    expect(paragraphs).toEqual(["first line same paragraph", "second paragraph"]);
  });

  it("renders bold, italic and inline code", () => {
    const container = renderMarkdown("A **bold** and *italic* call to `order.lineItems`.");

    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("italic");
    expect(container.querySelector("code")?.textContent).toBe("order.lineItems");
  });

  it("leaves underscores inside identifiers alone", () => {
    const container = renderMarkdown("Call snake_case_name or my__private__field here.");

    expect(container.querySelector("em")).toBeNull();
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toBe("Call snake_case_name or my__private__field here.");
  });

  it("keeps fenced code verbatim, without parsing Markdown inside it", () => {
    const container = renderMarkdown("```ts\nif (!order) return **null**;\n# not a heading\n```");

    const code = container.querySelector("pre code");
    expect(code?.textContent).toBe("if (!order) return **null**;\n# not a heading");
    expect(code?.getAttribute("data-language")).toBe("ts");
    expect(container.querySelector("strong")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders ordered and unordered lists", () => {
    const container = renderMarkdown("- one\n- two\n\n3. three\n4. four");

    expect([...container.querySelectorAll("ul > li")].map((node) => node.textContent)).toEqual([
      "one",
      "two",
    ]);
    const ordered = container.querySelector("ol");
    expect(ordered?.getAttribute("start")).toBe("3");
    expect([...(ordered?.querySelectorAll("li") ?? [])].map((node) => node.textContent)).toEqual([
      "three",
      "four",
    ]);
  });

  it("renders a blockquote", () => {
    const container = renderMarkdown("> quoted **text**\n> continues");

    const quote = container.querySelector("blockquote");
    expect(quote?.textContent).toBe("quoted text continues");
    expect(quote?.querySelector("strong")?.textContent).toBe("text");
  });

  it("opens http, https and mailto links in a new tab without an opener", () => {
    renderMarkdown(
      "See [the docs](https://example.com/docs), [plain](http://example.com) and [mail](mailto:dev@example.com).",
    );

    for (const [name, href] of [
      ["the docs", "https://example.com/docs"],
      ["plain", "http://example.com"],
      ["mail", "mailto:dev@example.com"],
    ]) {
      const link = screen.getByRole("link", { name });
      expect(link.getAttribute("href")).toBe(href);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer noopener");
    }
  });

  it("does not turn javascript:, data: or relative URLs into links", () => {
    const container = renderMarkdown(
      "[click](javascript:alert(1)) [data](data:text/html,hi) [local](/admin) <javascript:alert(1)>",
    );

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("[click](javascript:alert(1)");
    expect(container.textContent).toContain("[local](/admin)");
  });

  it("shows HTML and script tags as text instead of interpreting them", () => {
    const container = renderMarkdown(
      '<script>alert("x")</script>\n\n<img src=x onerror="alert(1)"> **<b>bold</b>**',
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain('<script>alert("x")</script>');
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(container.querySelector("strong")?.textContent).toBe("<b>bold</b>");
  });

  it("renders an unterminated code fence up to the end of the text", () => {
    const container = renderMarkdown("Before\n\n```\nconst a = 1;");

    expect(container.querySelector("pre code")?.textContent).toBe("const a = 1;");
  });
});
