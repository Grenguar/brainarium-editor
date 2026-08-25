import { contextBridge, ipcRenderer } from "electron";

import type {
  RecentVault,
  VaultDocumentContent,
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
  copyDocumentContent: (relativePath: string): Promise<void> =>
    ipcRenderer.invoke("document:copyContent", relativePath),
  listRecentVaults: (): Promise<RecentVault[]> =>
    ipcRenderer.invoke("vault:listRecent"),
  openRecentVault: (id: string): Promise<VaultSnapshot> =>
    ipcRenderer.invoke("vault:openRecent", id),
});

export type BrainariumApi = {
  chooseVault(): Promise<ChooseVaultResult>;
  copyDocumentContent(relativePath: string): Promise<void>;
  listRecentVaults(): Promise<RecentVault[]>;
  openRecentVault(id: string): Promise<VaultSnapshot>;
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
