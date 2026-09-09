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
 * Schema for HTML the main process emits as a string — the PDF exporter and the
 * read-only vault server — where there is no React component to vet URLs.
 *
 * The reading view never renders an `img` directly: it substitutes a LocalImage
 * component that refuses any source carrying a scheme and fetches bytes over
 * IPC instead. That component, not `brainariumSanitizeSchema`, is what keeps
 * remote images out of the reader. The reading schema's empty `protocols.src`
 * list does not forbid every protocol — an empty list disables protocol
 * filtering for that attribute altogether, so `http:` and `javascript:` sources
 * pass through it untouched. See sanitize-schema.test.ts, which pins this.
 *
 * Emitted HTML has no such component, so this schema names the protocols
 * explicitly: `data:` for the bytes the exporter inlines, and nothing else.
 * Relative and root-relative paths carry no scheme and are unaffected, which is
 * how the server's `/asset/...` sources survive.
 *
 * `brainarium-wiki:` hrefs are dropped: they resolve only inside the app, so
 * they are rewritten to real targets before sanitizing, and any that remain are
 * dead links.
 */
export const emittedHtmlSanitizeSchema: Schema = {
  ...brainariumSanitizeSchema,
  protocols: {
    href: ["http", "https"],
    src: ["data"],
  },
};
