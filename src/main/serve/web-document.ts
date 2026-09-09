import type {
  VaultDocumentContent,
  VaultSnapshot,
  VaultTreeDirectory,
  VaultTreeNode,
} from "../../shared/contracts/vault";
import { buildDocumentHtml, escapeHtml } from "../export/export-html";
import {
  addHeadingIds,
  assetUrl,
  documentUrl,
  rewriteLinks,
} from "./web-transforms";
import { webStyles } from "./web-styles";

/**
 * No scripts, no network, no framing. Images are same-origin only: every
 * reference is rewritten to an `/asset/` route that re-validates the file.
 * `form-action 'self'` exists solely for the pairing form.
 */
export const WEB_CSP = [
  "default-src 'none'",
  "img-src 'self'",
  "style-src 'unsafe-inline'",
  "font-src 'none'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

const shell = (title: string, body: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${WEB_CSP}">
<title>${escapeHtml(title)}</title>
<style>${webStyles}</style>
</head>
<body>
${body}
</body>
</html>`;

/** Never emits an absolute filesystem path; `rootPath` stays in main. */
const pageHeader = (document: VaultDocumentContent): string =>
  `<header class="page-header">
<p class="breadcrumb"><a href="/">All notes</a></p>
<h1>${escapeHtml(document.title)}</h1>
<p class="page-path">${escapeHtml(document.relativePath)}</p>
</header>`;

export const buildNotePage = async (
  document: VaultDocumentContent,
  snapshot: VaultSnapshot,
): Promise<string> =>
  buildDocumentHtml(document, {
    csp: WEB_CSP,
    header: pageHeader(document),
    missingImageLabel: "image unavailable",
    // An image is identified by the note that references it plus the raw
    // reference, because that is exactly what readVaultImage validates. The
    // path segment is the referring note; `ref` is its unresolved source.
    // Anything carrying a scheme is refused here rather than routed.
    resolveImageSrc: async (source) =>
      /^[a-z][a-z0-9+.-]*:/i.test(source) || source.startsWith("//")
        ? undefined
        : `${assetUrl(document.relativePath)}?ref=${encodeURIComponent(source)}`,
    styles: webStyles,
    wikiLinks: true,
    transforms: [
      rewriteLinks(snapshot.documents, document.relativePath),
      addHeadingIds(),
    ],
  });

const treeItems = (node: VaultTreeNode): string => {
  if (node.kind !== "directory") {
    return `<li><a href="${documentUrl(node.relativePath)}">${escapeHtml(node.name)}<span class="kind">${escapeHtml(node.kind)}</span></a></li>`;
  }
  const children = node.children.map(treeItems).join("\n");
  if (!node.relativePath) return `<ul>${children}</ul>`;
  return `<li><p class="folder">${escapeHtml(node.name)}</p><ul>${children}</ul></li>`;
};

export const buildIndexPage = (
  tree: VaultTreeDirectory,
  documentCount: number,
): string =>
  shell(
    "Vault",
    `<header class="page-header">
<p class="breadcrumb">Brainarium</p>
<h1>Vault</h1>
<p class="page-path">${documentCount} document${documentCount === 1 ? "" : "s"}</p>
</header>
<main><nav class="vault-index">${treeItems(tree)}</nav></main>`,
  );

export const buildPairPage = (failed: boolean): string =>
  shell(
    "Pair this device",
    `<main><form class="pair-form" method="POST" action="/pair">
<h1>Pair this device</h1>
<p>Enter the code shown in Brainarium on your computer.</p>
<input name="code" inputmode="latin" autocomplete="off" autocapitalize="characters" aria-label="Pairing code">
${failed ? '<p class="page-path">That code did not match.</p>' : ""}
<button type="submit">Pair</button>
</form></main>`,
  );

export const buildMessagePage = (title: string, message: string): string =>
  shell(
    title,
    `<header class="page-header"><p class="breadcrumb"><a href="/">All notes</a></p><h1>${escapeHtml(title)}</h1></header>
<main><p>${escapeHtml(message)}</p></main>`,
  );
