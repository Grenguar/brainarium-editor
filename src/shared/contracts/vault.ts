export type DocumentKind =
  "markdown" | "csv" | "text" | "json" | "xml" | "html";

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
  text: string;
  version: string;
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
