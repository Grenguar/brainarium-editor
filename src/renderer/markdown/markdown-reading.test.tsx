import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { VaultDocument } from "../../shared/contracts/vault";
import { MarkdownReading } from "./markdown-reading";

const notes: VaultDocument[] = [
  {
    kind: "markdown",
    mtimeMs: 0,
    name: "next.md",
    relativePath: "next.md",
    size: 0,
    title: "next",
  },
];

const render = (
  source: string,
  find?: { activeFindMatch: number; findQuery: string },
): string =>
  renderToStaticMarkup(
    <MarkdownReading
      activeFindMatch={find?.activeFindMatch}
      documents={notes}
      findQuery={find?.findQuery}
      onOpenDocument={() => undefined}
      onOpenExternal={() => undefined}
      source={source}
      sourceRelativePath="start.md"
    />,
  );

describe("MarkdownReading", () => {
  it("renders GFM, semantic blocks, frontmatter, and a deterministic heading id", () => {
    const markup = render(
      `---\ntitle: Example\n---\n# Heading one\n\n- [x] task\n\n| left | right |\n| :-- | --: |\n| one | two |\n\n~~old~~`,
    );

    expect(markup).toContain('<details class="markdown-properties">');
    expect(markup).toContain('<h1 id="heading-one">Heading one</h1>');
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("<table>");
    expect(markup).toContain("<del>old</del>");
  });

  it("sanitizes active/raw content while retaining safe semantic HTML", () => {
    const markup = render(
      `<script>window.pwned = true</script><iframe src="https://evil.example"></iframe><em>safe</em><img src="https://evil.example/x.png" alt="No network">`,
    );

    expect(markup).not.toContain("script");
    expect(markup).not.toContain("iframe");
    expect(markup).not.toContain("evil.example");
    expect(markup).toContain("<em>safe</em>");
    expect(markup).toContain("No network: unavailable");
  });

  it("renders wiki-links but preserves their literal form inside code", () => {
    const markup = render(
      "[[next|Open next]]\n\n`[[next]]`\n\n```md\n[[next]]\n```",
    );

    expect(markup).toContain("Open next");
    expect(markup).toContain("<code>[[next]]</code>");
    expect(markup).toContain('<code class="language-md">[[next]]');
  });

  it("highlights rendered find matches and marks the active match", () => {
    const markup = render("Loop once, then loop again.", {
      activeFindMatch: 1,
      findQuery: "loop",
    });

    expect(markup).toContain('class="find-highlight"');
    expect(markup).toContain('data-find-index="0"');
    expect(markup).toContain('data-find-index="1"');
    expect(markup).toContain('data-find-active="true"');
  });
});
