import type { Schema } from "hast-util-sanitize";

/**
 * Tight semantic HTML subset. `rehype-raw` parses raw Markdown HTML first and
 * `rehype-sanitize` applies this schema afterwards, so scripts, handlers,
 * styles, frames, remote media, and arbitrary attributes never reach React.
 */
export const brainariumSanitizeSchema: Schema = {
  attributes: {
    a: ["href", "title"],
    "*": ["abbr", "align", "alt", "colSpan", "rowSpan", "scope", "title"],
    code: [["className", /^language-[a-z0-9+-]+$/i]],
    img: ["alt", "height", "src", "title", "width"],
    input: [
      ["checked", true],
      ["disabled", true],
      ["type", "checkbox"],
    ],
    mark: ["className", "dataFindActive", "dataFindIndex"],
    ol: ["start"],
    td: ["align"],
    th: ["align", "scope"],
  },
  protocols: {
    href: ["http", "https", "brainarium-wiki"],
    src: [],
  },
  strip: [
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "form",
    "meta",
    "svg",
  ],
  tagNames: [
    "a",
    "b",
    "blockquote",
    "br",
    "code",
    "del",
    "details",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "input",
    "kbd",
    "li",
    "mark",
    "ol",
    "p",
    "pre",
    "s",
    "samp",
    "span",
    "strong",
    "sub",
    "summary",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
};

/**
 * Print variant used when the main process renders a document to PDF.
 *
 * The reading view strips every image `src` (`protocols.src: []`) because it
 * swaps in a LocalImage component that fetches bytes over IPC. A printed
 * document has no such escape hatch, so the exporter inlines verified image
 * bytes as `data:` URIs before sanitizing and this schema permits exactly that
 * one protocol. Without it every image would be silently dropped from the PDF.
 *
 * `brainarium-wiki:` links are dropped as well: they resolve inside the app and
 * would be dead links on paper.
 */
export const printSanitizeSchema: Schema = {
  ...brainariumSanitizeSchema,
  protocols: {
    href: ["http", "https"],
    src: ["data"],
  },
};
