import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "../test/axe";
import { Markdown, safeHref } from "./Markdown";

afterEach(cleanup);

function show(source: string) {
  return render(
    <MemoryRouter>
      <Markdown source={source} />
    </MemoryRouter>,
  );
}

describe("Markdown: normal text", () => {
  it("renders paragraphs, emphasis, lists and headings as elements", () => {
    const { container } = show(
      "# Title\n\nSome **bold** and *soft* text.\n\n- one\n- two\n\n1. a\n2. b",
    );
    expect(container.querySelector("h2")?.textContent).toBe("Title");
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("em")?.textContent).toBe("soft");
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("never makes an h1, so the screen keeps one", () => {
    expect(show("# A\n\n## B").container.querySelector("h1")).toBeNull();
  });

  it("keeps safe links", () => {
    const { container } = show("[help](https://example.org/help) and [back](/lessons)");
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["https://example.org/help", "/lessons"]);
    expect(container.querySelector("a[href^='https']")?.getAttribute("rel")).toBe(
      "noopener noreferrer",
    );
  });

  it("has no axe violations", async () => {
    const { container } = show("## Heading\n\nText with a [link](/lessons).\n\n- item");
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("Markdown: hostile input never reaches the page", () => {
  const hostile = [
    "<script>window.__pwned = 1</script>",
    "Hello <script>window.__pwned = 1</script> world",
    '<img src=x onerror="window.__pwned = 1">',
    "text <img src=x onerror=alert(1)> text",
    '<iframe src="https://evil.example"></iframe>',
    '<div onclick="alert(1)">click</div>',
    '<a href="javascript:alert(1)">bad</a>',
    "[bad](javascript:alert(1))",
    "[bad](JaVaScRiPt:alert(1))",
    "[bad](java\tscript:alert(1))",
    "[bad](data:text/html;base64,PHNjcmlwdD4=)",
    "[bad](vbscript:msgbox(1))",
    "![pic](https://evil.example/track.png)",
    "![pic](/media/local.png)",
    "<svg onload=alert(1)></svg>",
    "<style>body{display:none}</style>",
    "<object data='x'></object><embed src='x'>",
    "<form action='https://evil.example'><input></form>",
    "<!-- comment --><b>x</b>",
  ];

  it.each(hostile)("makes no dangerous element or attribute from %j", (source) => {
    const { container } = show(source);
    for (const tag of [
      "script",
      "iframe",
      "img",
      "svg",
      "style",
      "object",
      "embed",
      "form",
      "input",
    ]) {
      expect(container.querySelector(tag), `<${tag}> element`).toBeNull();
    }
    expect(container.querySelector("[onerror], [onclick], [onload]")).toBeNull();
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/^\s*(javascript|data|vbscript):/i);
    }
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("shows raw HTML as harmless text, not as markup", () => {
    const { container } = show("<script>alert(1)</script>");
    expect(container.textContent).toContain("<script>alert(1)</script>");
    expect(container.querySelector("script")).toBeNull();
  });

  it("turns an unsafe link into plain text and keeps the words", () => {
    const { container } = show("[click me](javascript:alert(1))");
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("click me");
  });

  it("does not load an image named in the text", () => {
    const { container } = show("![a drawing](https://evil.example/x.png)");
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("a drawing");
  });
});

describe("safeHref", () => {
  it.each([
    ["/lessons", "/lessons"],
    ["https://example.org/a", "https://example.org/a"],
    ["mailto:a@example.org", "mailto:a@example.org"],
  ])("keeps %s", (input, expected) => {
    expect(safeHref(input)).toBe(expected);
  });

  it.each([
    "javascript:alert(1)",
    " javascript:alert(1)",
    "java\nscript:alert(1)",
    "data:text/html,hi",
    "http://example.org",
    "//evil.example",
    "/\\evil.example",
    "relative/path",
    "",
  ])("drops %j", (input) => {
    expect(safeHref(input)).toBeNull();
  });
});
