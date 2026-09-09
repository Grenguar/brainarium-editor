import rehypeParse from "rehype-parse";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

import { remarkWikiLinks } from "../../shared/markdown/remark-wiki-links";

import type { VaultDocumentContent } from "../../shared/contracts/vault";
import { nonEmptyCells, parseCsv, toCsvTable } from "../../shared/csv";
import { emittedHtmlSanitizeSchema } from "../../shared/markdown/sanitize-schema";
import { printStyles } from "./print-styles";

/** Rows and columns beyond these bounds are dropped, with a stated notice. */
export const MAX_CSV_ROWS = 1_000;
export const MAX_CSV_COLUMNS = 40;

const PRINT_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'";

/**
 * Resolves a document-relative image reference to a value fit for `src`, or
 * undefined when it cannot be rendered. Injected so the builder stays pure and
 * testable: the exporter returns a `data:` URI, the server a same-origin path.
 */
export type InlineImage = (source: string) => Promise<string | undefined>;

export type HastNode = {
  children?: HastNode[];
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
  value?: string;
};

/** Runs after raw HTML is parsed and before sanitization. */
export type HastTransform = (tree: HastNode) => Promise<void> | void;

export type DocumentHtmlOptions = {
  /** Content-Security-Policy for the emitted page. */
  csp: string;
  /** Rendered above the document body. */
  header?: string;
  resolveImageSrc: InlineImage;
  /** Inlined into a <style> element; the page never loads a stylesheet. */
  styles: string;
  /** Substituted when an image cannot be resolved. */
  missingImageLabel?: string;
  /** Applied in order, after rehype-raw and before sanitize. */
  transforms?: HastTransform[];
  /**
   * Parses `[[Note]]` into links. Off for print, where a resolved wiki link
   * would only be a dead reference on paper; on for the server, which rewrites
   * them to real routes.
   */
  wikiLinks?: boolean;
};

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const visitElements = (
  tree: HastNode,
  tagName: string,
  visit: (node: HastNode) => void,
): void => {
  if (tree.type === "element" && tree.tagName === tagName) visit(tree);
  for (const child of tree.children ?? []) visitElements(child, tagName, visit);
};

/**
 * Rewrites local image sources to whatever the caller's resolver returns.
 *
 * Order matters: `emittedHtmlSanitizeSchema` permits only the `data:` protocol
 * and schemeless paths, so a source still holding a remote reference when
 * sanitize runs loses its `src` and renders as an empty box.
 */
export const inlineImages =
  (resolve: InlineImage, missingLabel = "image not exported"): HastTransform =>
  async (tree) => {
    const images: HastNode[] = [];
    visitElements(tree, "img", (node) => images.push(node));

    for (const image of images) {
      const source = image.properties?.src;
      if (typeof source !== "string") continue;
      let resolved: string | undefined;
      try {
        resolved = await resolve(source);
      } catch {
        resolved = undefined;
      }
      if (resolved) {
        image.properties = { ...image.properties, src: resolved };
      } else {
        // Losing one asset must never cost the reader the whole document.
        delete image.properties?.src;
        image.tagName = "span";
        image.children = [
          { type: "text", value: `[${missingLabel}: ${source}]` },
        ];
      }
    }
  };

const applyTransforms =
  (transforms: HastTransform[]) => () => async (tree: HastNode) => {
    for (const transform of transforms) await transform(tree);
  };

const markdownToHtml = async (
  text: string,
  options: DocumentHtmlOptions,
): Promise<string> => {
  const transforms = [
    inlineImages(options.resolveImageSrc, options.missingImageLabel),
    ...(options.transforms ?? []),
  ];
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm);
  if (options.wikiLinks) pipeline.use(remarkWikiLinks);
  const file = await pipeline
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(applyTransforms(transforms))
    .use(rehypeSanitize, emittedHtmlSanitizeSchema)
    .use(rehypeStringify)
    .process(text);
  return String(file);
};

/** Vault HTML is inert source everywhere else in Brainarium; emitted HTML is no
 * exception, so it is parsed and sanitized rather than passed through. */
const htmlToSafeHtml = async (text: string): Promise<string> => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, emittedHtmlSanitizeSchema)
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
  options: DocumentHtmlOptions,
): Promise<string> => {
  switch (document.kind) {
    case "markdown":
      return markdownToHtml(document.text, options);
    case "csv":
      return csvToHtml(document.text);
    case "html":
      return htmlToSafeHtml(document.text);
    default:
      return `<pre>${escapeHtml(document.text)}</pre>`;
  }
};

/**
 * Builds a complete, self-contained HTML page for one vault document.
 *
 * The page carries its own restrictive CSP, inlines its stylesheet, and never
 * references the network. Callers supply the styles, the policy, and how an
 * image reference becomes a `src`; nothing here knows whether the result will
 * be printed or served.
 */
export const buildDocumentHtml = async (
  document: VaultDocumentContent,
  options: DocumentHtmlOptions,
): Promise<string> => {
  const body = await bodyFor(document, options);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${options.csp}">
<title>${escapeHtml(document.title)}</title>
<style>${options.styles}</style>
</head>
<body>
${options.header ?? ""}
<main>
${body}
</main>
</body>
</html>`;
};

/** Print preset: paginated styles, image bytes inlined as data URIs. */
export const buildPrintDocument = async (
  document: VaultDocumentContent,
  resolve: InlineImage,
): Promise<string> =>
  buildDocumentHtml(document, {
    csp: PRINT_CSP,
    header: `<header class="export-header">
<h1>${escapeHtml(document.title)}</h1>
<p class="export-path">${escapeHtml(document.relativePath)}</p>
</header>`,
    resolveImageSrc: resolve,
    styles: printStyles,
  });
