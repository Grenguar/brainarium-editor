import rehypeParse from "rehype-parse";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import type { VaultDocumentContent } from "../../shared/contracts/vault";
import { nonEmptyCells, parseCsv, toCsvTable } from "../../shared/csv";
import { printSanitizeSchema } from "../../shared/markdown/sanitize-schema";
import { printStyles } from "./print-styles";

/** Rows and columns beyond these bounds are dropped, with a stated notice. */
export const MAX_CSV_ROWS = 1_000;
export const MAX_CSV_COLUMNS = 40;

/**
 * Resolves a document-relative image reference to an inline `data:` URI, or
 * undefined when it cannot be exported. Injected so the whole builder stays
 * pure and testable without Electron or the filesystem.
 */
export type InlineImage = (source: string) => Promise<string | undefined>;

type HastNode = {
  children?: HastNode[];
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
  value?: string;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Rewrites local image sources to inline data URIs before sanitization.
 *
 * Order matters: the print schema only permits the `data:` protocol, so an
 * image still holding its original relative source when sanitize runs would
 * lose its `src` and render as an empty box.
 */
const inlineImages =
  (resolve: InlineImage) =>
  () =>
  async (tree: HastNode): Promise<void> => {
    const images: HastNode[] = [];
    const collect = (node: HastNode): void => {
      if (node.type === "element" && node.tagName === "img") images.push(node);
      for (const child of node.children ?? []) collect(child);
    };
    collect(tree);

    for (const image of images) {
      const source = image.properties?.src;
      if (typeof source !== "string") continue;
      let inlined: string | undefined;
      try {
        inlined = await resolve(source);
      } catch {
        inlined = undefined;
      }
      if (inlined) {
        image.properties = { ...image.properties, src: inlined };
      } else {
        // Losing one asset must never cost the reader the whole export.
        delete image.properties?.src;
        image.tagName = "span";
        image.children = [
          { type: "text", value: `[image not exported: ${source}]` },
        ];
      }
    }
  };

const markdownToHtml = async (
  text: string,
  resolve: InlineImage,
): Promise<string> => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(inlineImages(resolve))
    .use(rehypeSanitize, printSanitizeSchema)
    .use(rehypeStringify)
    .process(text);
  return String(file);
};

/** Vault HTML is inert source everywhere else in Brainarium; printing is no
 * exception, so it is parsed and sanitized rather than passed through. */
const htmlToSafeHtml = async (text: string): Promise<string> => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, printSanitizeSchema)
    .use(rehypeStringify)
    .process(text);
  return String(file);
};

const csvToHtml = (text: string): string => {
  const table = toCsvTable(parseCsv(text));
  const columnCount = Math.min(table.header.length, MAX_CSV_COLUMNS);
  const columns = Array.from({ length: columnCount }, (_, index) => index);
  const rows = table.rows.slice(0, MAX_CSV_ROWS);

  const notices: string[] = [];
  if (table.rows.length > rows.length) {
    notices.push(
      `Showing the first ${rows.length.toLocaleString()} of ${table.rows.length.toLocaleString()} rows.`,
    );
  }
  if (table.header.length > columnCount) {
    notices.push(
      `Showing the first ${columnCount} of ${table.header.length} columns.`,
    );
  }

  const metadata = table.metadata
    .map(
      (row) =>
        `<p class="csv-meta">${escapeHtml(nonEmptyCells(row).join(" · "))}</p>`,
    )
    .join("\n");
  const head = columns
    .map(
      (column) =>
        `<th>${escapeHtml(table.header[column] ?? `Column ${column + 1}`)}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`).join("")}</tr>`,
    )
    .join("\n");

  return [
    metadata,
    notices.length
      ? `<p class="export-notice">${escapeHtml(notices.join(" "))}</p>`
      : "",
    `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
  ]
    .filter(Boolean)
    .join("\n");
};

const bodyFor = async (
  document: VaultDocumentContent,
  resolve: InlineImage,
): Promise<string> => {
  switch (document.kind) {
    case "markdown":
      return markdownToHtml(document.text, resolve);
    case "csv":
      return csvToHtml(document.text);
    case "html":
      return htmlToSafeHtml(document.text);
    default:
      return `<pre>${escapeHtml(document.text)}</pre>`;
  }
};

/**
 * Builds the complete, self-contained document handed to the hidden print
 * window. It carries its own restrictive CSP and never references the network:
 * the print window runs with JavaScript disabled, so nothing here may depend on
 * scripting or webfont loading.
 */
export const buildPrintDocument = async (
  document: VaultDocumentContent,
  resolve: InlineImage,
): Promise<string> => {
  const body = await bodyFor(document, resolve);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'">
<title>${escapeHtml(document.title)}</title>
<style>${printStyles}</style>
</head>
<body>
<header class="export-header">
<h1>${escapeHtml(document.title)}</h1>
<p class="export-path">${escapeHtml(document.relativePath)}</p>
</header>
<main>
${body}
</main>
</body>
</html>`;
};
