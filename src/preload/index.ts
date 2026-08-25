import { contextBridge, ipcRenderer } from "electron";

import type {
  RecentVault,
  VaultDocumentContent,
  VaultLinkGraph,
  VaultSearchResult,
  VaultSnapshot,
} from "../shared/contracts/vault";

type ChooseVaultResult =
  { cancelled: true } | { cancelled: false; snapshot: VaultSnapshot };

contextBridge.exposeInMainWorld("brainarium", {
  chooseVault: (): Promise<ChooseVaultResult> =>
    ipcRenderer.invoke("vault:choose"),
  readDocument: (relativePath: string): Promise<VaultDocumentContent> =>
    ipcRenderer.invoke("document:read", relativePath),
  saveDocument: (input: {
    baseVersion: string;
    relativePath: string;
    text: string;
  }): Promise<VaultDocumentContent> =>
    ipcRenderer.invoke("document:save", input),
  buildGraph: (): Promise<{
    graphPath: string;
    nodeCount: number;
    reportPath: string;
  }> => ipcRenderer.invoke("graphify:build"),
  buildVaultLinkGraph: (): Promise<VaultLinkGraph> =>
    ipcRenderer.invoke("vault:linkGraph"),
  copyDocumentContent: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke("document:copyContent", relativePath),
  listRecentVaults: (): Promise<RecentVault[]> =>
    ipcRenderer.invoke("vault:listRecent"),
  openRecentVault: (id: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke("vault:openRecent", id),
  searchVault: (query: string): Promise<VaultSearchResult[]> =>
    ipcRenderer.invoke("vault:search", query),
});

export type BrainariumApi = {
  chooseVault(): Promise<ChooseVaultResult>;
  copyDocumentContent(relativePath: string): Promise<void>;
  buildVaultLinkGraph(): Promise<VaultLinkGraph>;
  listRecentVaults(): Promise<RecentVault[]>;
  openRecentVault(id: string): Promise<VaultSnapshot>;
  searchVault(query: string): Promise<VaultSearchResult[]>;
  readDocument(relativePath: string): Promise<VaultDocumentContent>;
  saveDocument(input: {
    baseVersion: string;
    relativePath: string;
    text: string;
  }): Promise<VaultDocumentContent>;
  buildGraph(): Promise<{
    graphPath: string;
    nodeCount: number;
    reportPath: string;
  }>;
};
