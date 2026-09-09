import type { DocumentKind } from "./contracts/vault";

/**
 * Image and PDF documents are delivered to the renderer as validated bytes, not
 * text, so every action that reads a document's text — copy, export — is
 * unavailable for them. Kept in one place because the exclusion is applied from
 * both the toolbar and the file context menu, and the two must not drift when a
 * new document kind is added.
 */
export const hasTextContent = (kind: DocumentKind): boolean =>
  kind !== "image" && kind !== "pdf";
