import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import type { Schema } from "hast-util-sanitize";
import { describe, expect, it } from "vitest";

import {
  brainariumSanitizeSchema,
  emittedHtmlSanitizeSchema,
} from "./sanitize-schema";

const sanitize = async (schema: Schema, html: string): Promise<string> =>
  String(
    await unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize, schema)
      .use(rehypeStringify)
      .process(html),
  );

const image = (source: string): string => `<img src="${source}" alt="d">`;

describe("emittedHtmlSanitizeSchema", () => {
  it("keeps the same-origin asset paths the server and exporter emit", async () => {
    await expect(
      sanitize(emittedHtmlSanitizeSchema, image("/asset/diagram.png")),
    ).resolves.toContain('src="/asset/diagram.png"');
    await expect(
      sanitize(emittedHtmlSanitizeSchema, image("diagram.png")),
    ).resolves.toContain('src="diagram.png"');
  });

  it("keeps the data URIs the PDF exporter inlines", async () => {
    await expect(
      sanitize(emittedHtmlSanitizeSchema, image("data:image/png;base64,AAA")),
    ).resolves.toContain('src="data:image/png;base64,AAA"');
  });

  it("drops remote and scripted image sources", async () => {
    await expect(
      sanitize(emittedHtmlSanitizeSchema, image("http://evil.test/x.png")),
    ).resolves.not.toContain("evil.test");
    await expect(
      sanitize(emittedHtmlSanitizeSchema, image("javascript:alert(1)")),
    ).resolves.not.toContain("javascript:");
  });

  it("drops brainarium-wiki hrefs, which only resolve inside the app", async () => {
    await expect(
      sanitize(
        emittedHtmlSanitizeSchema,
        '<a href="brainarium-wiki:Note">x</a>',
      ),
    ).resolves.not.toContain("brainarium-wiki");
  });

  it("keeps rewritten in-vault links and external http(s) links", async () => {
    await expect(
      sanitize(emittedHtmlSanitizeSchema, '<a href="/n/note.md">x</a>'),
    ).resolves.toContain('href="/n/note.md"');
    await expect(
      sanitize(
        emittedHtmlSanitizeSchema,
        '<a href="https://example.com">x</a>',
      ),
    ).resolves.toContain("https://example.com");
  });

  it("strips scripts and event handlers", async () => {
    const html = await sanitize(
      emittedHtmlSanitizeSchema,
      '<script>bad()</script><p onclick="steal()">Body</p>',
    );
    expect(html).toContain("Body");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
  });
});

describe("brainariumSanitizeSchema", () => {
  it("strips scripts and event handlers", async () => {
    const html = await sanitize(
      brainariumSanitizeSchema,
      '<script>bad()</script><p onmouseover="steal()">Body</p>',
    );
    expect(html).toContain("Body");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onmouseover");
  });

  it("keeps brainarium-wiki hrefs, which the reading view resolves itself", async () => {
    await expect(
      sanitize(
        brainariumSanitizeSchema,
        '<a href="brainarium-wiki:Note">x</a>',
      ),
    ).resolves.toContain("brainarium-wiki:Note");
  });

  /**
   * Pins a genuine sharp edge: an EMPTY `protocols` list disables protocol
   * filtering for that attribute rather than forbidding every protocol, so the
   * reading schema alone does not block remote or scripted image sources. The
   * reading view is protected instead by its `img` component override, which
   * refuses any source carrying a scheme. Anything that emits HTML as a string
   * must use `emittedHtmlSanitizeSchema`, which does filter.
   */
  it("does NOT itself filter image source protocols", async () => {
    await expect(
      sanitize(brainariumSanitizeSchema, image("http://evil.test/x.png")),
    ).resolves.toContain("evil.test");
  });
});
