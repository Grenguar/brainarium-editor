import { contextBridge, ipcRenderer } from "electron";

import type {
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
});

export type BrainariumApi = {
  chooseVault(): Promise<ChooseVaultResult>;
  readDocument(relativePath: string): Promise<VaultDocumentContent>;
};
