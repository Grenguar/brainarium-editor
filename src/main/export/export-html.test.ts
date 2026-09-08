import { describe, expect, it, vi } from "vitest";

import type { VaultDocumentContent } from "../../shared/contracts/vault";
import { MAX_CSV_ROWS, buildPrintDocument } from "./export-html";

const PIXEL = "data:image/png;base64,iVBORw0KGgo=";

const document = (
  kind: VaultDocumentContent["kind"],
  text: string,
): VaultDocumentContent => ({
  kind,
  relativePath: `notes/example.${kind}`,
  text,
  title: "Example",
  version: "1",
});

const noImages = vi.fn(async () => undefined);

describe("buildPrintDocument", () => {
  it("inlines resolved images as data URIs", async () => {
    // Regression guard: the reading schema sets `protocols.src: []`, so reusing
    // it here would silently strip every image from the exported PDF.
    const html = await buildPrintDocument(
      document("markdown", "# Title\n\n![Diagram](diagram.png)\n"),
      async () => PIXEL,
    );

    expect(html).toContain(`src="${PIXEL}"`);
    expect(html).not.toContain("image not exported");
  });

  it("substitutes a note rather than failing when an image cannot be resolved", async () => {
    const html = await buildPrintDocument(
      document("markdown", "![Missing](gone.png)\n"),
      async () => {
        throw new Error("unreadable");
      },
    );

    expect(html).toContain("image not exported: gone.png");
    expect(html).not.toContain("<img");
  });

  it("strips scripts and event handlers from raw Markdown HTML", async () => {
    const html = await buildPrintDocument(
      document(
        "markdown",
        'Before\n\n<script>alert(1)</script>\n\n<p onclick="steal()">After</p>\n',
      ),
      noImages,
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick");
    expect(html).toContain("After");
  });

  it("sanitizes vault HTML instead of trusting it", async () => {
    const html = await buildPrintDocument(
      document("html", '<p onmouseover="x()">Body</p><script>bad()</script>'),
      noImages,
    );

    expect(html).toContain("Body");
    expect(html).not.toContain("onmouseover");
    expect(html).not.toContain("bad()");
  });

  it("keeps plain text as escaped source rather than markup", async () => {
    const html = await buildPrintDocument(
      document("json", '{"tag": "<b>not bold</b>"}'),
      noImages,
    );

    expect(html).toContain("&lt;b&gt;not bold&lt;/b&gt;");
    expect(html).not.toContain("<b>not bold</b>");
  });

  it("renders CSV as a table with a repeating header", async () => {
    const html = await buildPrintDocument(
      document("csv", "name,amount\nCoffee,3\nTea,2\n"),
      noImages,
    );

    expect(html).toContain("<thead><tr><th>name</th><th>amount</th></tr>");
    expect(html).toContain("<td>Coffee</td>");
    expect(html).toContain("display: table-header-group");
  });

  it("caps very large CSV files and states the truncation", async () => {
    const rows = Array.from(
      { length: MAX_CSV_ROWS + 500 },
      (_, index) => `Row ${index},${index}`,
    ).join("\n");
    const html = await buildPrintDocument(
      document("csv", `name,amount\n${rows}\n`),
      noImages,
    );

    expect(html).toContain(
      `Showing the first ${MAX_CSV_ROWS.toLocaleString()}`,
    );
    expect(html.match(/<tr><td>/g)).toHaveLength(MAX_CSV_ROWS);
  });

  it("never carries the app's dark theme into an export", async () => {
    const html = await buildPrintDocument(
      document("markdown", "# Title\n"),
      noImages,
    );

    expect(html).toContain("color-scheme: light");
    expect(html).not.toContain('data-theme="dark"');
  });

  it("declares a network-free content security policy", async () => {
    const html = await buildPrintDocument(
      document("markdown", "# Title\n"),
      noImages,
    );

    expect(html).toContain("default-src 'none'; img-src data:");
  });
});
