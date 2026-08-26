import { contextBridge, ipcRenderer } from "electron";

import type {
  BrainariumAppInfo,
  DocumentSaveInput,
  DocumentSaveResult,
  RecentVault,
  VaultDocumentContent,
  VaultImageContent,
  VaultImageRequest,
  VaultLinkGraph,
  VaultSearchResult,
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
  readLocalImage: (request: VaultImageRequest): Promise<VaultImageContent> =>
    ipcRenderer.invoke("document:readLocalImage", request),
  openExternalLink: (target: string): Promise<void> =>
    ipcRenderer.invoke("document:openExternal", target),
  saveDocument: (input: DocumentSaveInput): Promise<DocumentSaveResult> =>
    ipcRenderer.invoke("document:save", input),
  buildVaultLinkGraph: (): Promise<VaultLinkGraph> =>
    ipcRenderer.invoke("vault:linkGraph"),
  copyDocumentContent: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke("document:copyContent", relativePath),
  listRecentVaults: (): Promise<RecentVault[]> =>
    ipcRenderer.invoke("vault:listRecent"),
  openRecentVault: (id: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke("vault:openRecent", id),
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
});

export type BrainariumApi = {
  appInfo(): Promise<BrainariumAppInfo>;
  chooseVault(): Promise<ChooseVaultResult>;
  copyDocumentContent(relativePath: string): Promise<void>;
  buildVaultLinkGraph(): Promise<VaultLinkGraph>;
  listRecentVaults(): Promise<RecentVault[]>;
  openRecentVault(id: string): Promise<VaultSnapshot>;
  onVaultChanged(callback: (snapshot: VaultSnapshot) => void): () => void;
  onVaultGraphChanged(callback: (graph: VaultLinkGraph) => void): () => void;
  openExternalLink(target: string): Promise<void>;
  readLocalImage(request: VaultImageRequest): Promise<VaultImageContent>;
  searchVault(query: string): Promise<VaultSearchResult[]>;
  readDocument(relativePath: string): Promise<VaultDocumentContent>;
  saveDocument(input: DocumentSaveInput): Promise<DocumentSaveResult>;
};
