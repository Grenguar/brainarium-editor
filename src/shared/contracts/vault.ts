export type DocumentKind =
  "markdown" | "csv" | "text" | "json" | "xml" | "html" | "image" | "pdf";

export type VaultDocument = {
  kind: DocumentKind;
  mtimeMs: number;
  name: string;
  relativePath: string;
  size: number;
  title: string;
};

export type VaultTreeDirectory = {
  children: VaultTreeNode[];
  kind: "directory";
  name: string;
  relativePath: string;
};

export type VaultTreeFile = VaultDocument & {
  kind: DocumentKind;
};

export type VaultTreeNode = VaultTreeDirectory | VaultTreeFile;

export type VaultScanIssue = {
  code: "external-symlink" | "inaccessible-entry" | "symlink-cycle";
  relativePath: string;
};

export type VaultSnapshot = {
  documents: VaultDocument[];
  issues: VaultScanIssue[];
  rootPath: string;
  tree: VaultTreeDirectory;
};

export type VaultDocumentContent = Pick<
  VaultDocument,
  "kind" | "relativePath" | "title"
> & {
  image?: VaultImageContent;
  pdf?: VaultPdfContent;
  text: string;
  version: string;
};

/** The only shape the renderer may use when persisting a Markdown draft. */
export type DocumentSaveInput = {
  baseVersion: string;
  relativePath: string;
  text: string;
};

/**
 * Expected save outcomes are values rather than opaque IPC failures so the
 * renderer can distinguish a recoverable external edit from an operational
 * problem. The main process remains the sole authority for the disk version.
 */
export type DocumentSaveResult =
  | { document: VaultDocumentContent; status: "saved" }
  | {
      disk: VaultDocumentContent;
      relativePath: string;
      requestedBaseVersion: string;
      status: "conflict";
    }
  | { relativePath: string; status: "missing" };

/**
 * State of the opt-in read-only vault server.
 *
 * The port is loopback-only; reaching it from another device is left to
 * `tailscale serve`, so no externally reachable socket is ever opened. The
 * pairing code is shown once in the app and typed on the reading device.
 */
export type VaultServeStatus =
  { code: string; port: number; running: true } | { running: false };

/**
 * The renderer asks for an export by path only. It supplies neither markup nor
 * a destination: the main process re-reads the saved document, builds the
 * printable HTML itself, and asks the user where to write the result.
 */
export type DocumentExportRequest = {
  relativePath: string;
};

/**
 * Expected outcomes are values, not thrown errors, mirroring
 * DocumentSaveResult. Only an operational failure (an unwritable target, a
 * print that never completes) rejects.
 */
export type DocumentExportResult =
  | { fileName: string; status: "exported" }
  | { status: "busy" }
  | { status: "cancelled" }
  | { kind: DocumentKind; status: "unsupported" }
  | { relativePath: string; status: "missing" };

/** A narrowly-scoped local image request made by the rendered Markdown view. */
export type VaultImageRequest = {
  assetPath: string;
  sourceRelativePath: string;
};

/**
 * Bytes returned only after the main process has verified vault containment,
 * file size, file type, and content signature. The renderer turns these into
 * a short-lived blob URL; it never receives a filesystem path.
 */
export type VaultImageContent = {
  bytes: Uint8Array;
  mimeType:
    "image/avif" | "image/gif" | "image/jpeg" | "image/png" | "image/webp";
};

/**
 * Bytes for one scanned, active-vault PDF. The renderer creates a short-lived
 * blob URL for Chromium's sandboxed PDF viewer; it never receives a path.
 */
export type VaultPdfContent = {
  bytes: Uint8Array;
  mimeType: "application/pdf";
};

export type ImageImportResult = {
  markdown: string;
  relativePath: string;
};

/** A non-vault, per-file review state derived from App Support snapshots. */
export type DocumentReviewState = {
  changed: boolean;
  changedAt?: number;
  relativePath: string;
};

/** The bounded source pair used by the read-only changed-since-review panel. */
export type MarkdownChangeReview = DocumentReviewState & {
  currentText?: string;
  previousText?: string;
};

export type RecentVault = {
  id: string;
  lastOpenedAt: string;
  name: string;
};

export type VaultSearchResult = Pick<
  VaultDocument,
  "kind" | "relativePath" | "title"
> & {
  matches: number;
  snippet: string;
};

export type VaultLinkGraph = {
  edges: Array<{ source: string; target: string }>;
  nodes: Array<Pick<VaultDocument, "relativePath" | "title">>;
};

/** Public application identity exposed through the narrow preload bridge. */
export type BrainariumAppInfo = {
  description: string;
  name: string;
  version: string;
};

/**
 * Renderer-owned UI state that is safe to persist locally for the active
 * vault. Paths are always vault-relative; the main process owns the vault
 * root and rejects paths that are not in its scanned document list.
 */
export type VaultSessionState = {
  activeDocumentPath?: string;
  scrollPositions: Record<string, number>;
};

/** The restored session never exposes the on-disk path selected previously. */
export type RestoredVaultSession = VaultSessionState & {
  snapshot?: VaultSnapshot;
};
