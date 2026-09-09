import { contextBridge, ipcRenderer } from "electron";

import type {
  BrainariumAppInfo,
  DocumentExportRequest,
  DocumentExportResult,
  DocumentSaveInput,
  DocumentSaveResult,
  DocumentReviewState,
  RecentVault,
  RestoredVaultSession,
  MarkdownChangeReview,
  VaultDocumentContent,
  VaultImageContent,
  ImageImportResult,
  VaultImageRequest,
  VaultLinkGraph,
  VaultSearchResult,
  VaultSessionState,
  VaultSnapshot,
} from "../shared/contracts/vault";

type ChooseVaultResult =
  { cancelled: true } | { cancelled: false; snapshot: VaultSnapshot };

contextBridge.exposeInMainWorld("brainarium", {
  appInfo: (): Promise<BrainariumAppInfo> => ipcRenderer.invoke("app:info"),
  chooseVault: (): Promise<ChooseVaultResult> =>
    ipcRenderer.invoke("vault:choose"),
  readDocument: (relativePath: string): Promise<VaultDocumentContent> =>
    ipcRenderer.invoke("document:read", relativePath),
  changeReview: (
    relativePath: string,
  ): Promise<MarkdownChangeReview | undefined> =>
    ipcRenderer.invoke("document:changeReview", relativePath),
  markReviewed: (relativePath: string): Promise<DocumentReviewState[]> =>
    ipcRenderer.invoke("document:markReviewed", relativePath),
  readLocalImage: (request: VaultImageRequest): Promise<VaultImageContent> =>
    ipcRenderer.invoke("document:readLocalImage", request),
  importImage: (sourceRelativePath: string): Promise<ImageImportResult> =>
    ipcRenderer.invoke("document:importImage", sourceRelativePath),
  openExternalLink: (target: string): Promise<void> =>
    ipcRenderer.invoke("document:openExternal", target),
  saveDocument: (input: DocumentSaveInput): Promise<DocumentSaveResult> =>
    ipcRenderer.invoke("document:save", input),
  buildVaultLinkGraph: (): Promise<VaultLinkGraph> =>
    ipcRenderer.invoke("vault:linkGraph"),
  copyDocumentContent: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke("document:copyContent", relativePath),
  copyDocumentPath: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke("document:copyPath", relativePath),
  listRecentVaults: (): Promise<RecentVault[]> =>
    ipcRenderer.invoke("vault:listRecent"),
  openRecentVault: (id: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke("vault:openRecent", id),
  restoreVaultSession: (): Promise<RestoredVaultSession> =>
    ipcRenderer.invoke("vault:restoreSession"),
  saveVaultSession: (session: VaultSessionState): Promise<void> =>
    ipcRenderer.invoke("vault:saveSession", session),
  onVaultChanged: (
    callback: (snapshot: VaultSnapshot) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      snapshot: VaultSnapshot,
    ) => callback(snapshot);
    ipcRenderer.on("vault:changed", listener);
    return () => ipcRenderer.removeListener("vault:changed", listener);
  },
  onVaultGraphChanged: (
    callback: (graph: VaultLinkGraph) => void,
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      graph: VaultLinkGraph,
    ) => callback(graph);
    ipcRenderer.on("vault:graphChanged", listener);
    return () => ipcRenderer.removeListener("vault:graphChanged", listener);
  },
  searchVault: (query: string): Promise<VaultSearchResult[]> =>
    ipcRenderer.invoke("vault:search", query),
  reviewStates: (): Promise<DocumentReviewState[]> =>
    ipcRenderer.invoke("vault:reviewStates"),
  markAllReviewed: (): Promise<DocumentReviewState[]> =>
    ipcRenderer.invoke("vault:markAllReviewed"),
  exportDocumentPdf: (
    request: DocumentExportRequest,
  ): Promise<DocumentExportResult> =>
    ipcRenderer.invoke("document:exportPdf", request),
});

export type BrainariumApi = {
  appInfo(): Promise<BrainariumAppInfo>;
  chooseVault(): Promise<ChooseVaultResult>;
  copyDocumentContent(relativePath: string): Promise<void>;
  copyDocumentPath(relativePath: string): Promise<void>;
  buildVaultLinkGraph(): Promise<VaultLinkGraph>;
  listRecentVaults(): Promise<RecentVault[]>;
  openRecentVault(id: string): Promise<VaultSnapshot>;
  restoreVaultSession(): Promise<RestoredVaultSession>;
  saveVaultSession(session: VaultSessionState): Promise<void>;
  onVaultChanged(callback: (snapshot: VaultSnapshot) => void): () => void;
  onVaultGraphChanged(callback: (graph: VaultLinkGraph) => void): () => void;
  openExternalLink(target: string): Promise<void>;
  readLocalImage(request: VaultImageRequest): Promise<VaultImageContent>;
  importImage(sourceRelativePath: string): Promise<ImageImportResult>;
  changeReview(relativePath: string): Promise<MarkdownChangeReview | undefined>;
  markReviewed(relativePath: string): Promise<DocumentReviewState[]>;
  searchVault(query: string): Promise<VaultSearchResult[]>;
  exportDocumentPdf(
    request: DocumentExportRequest,
  ): Promise<DocumentExportResult>;
  markAllReviewed(): Promise<DocumentReviewState[]>;
  reviewStates(): Promise<DocumentReviewState[]>;
  readDocument(relativePath: string): Promise<VaultDocumentContent>;
  saveDocument(input: DocumentSaveInput): Promise<DocumentSaveResult>;
};
