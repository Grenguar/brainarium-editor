import { contextBridge, ipcRenderer } from "electron";

import type { VaultSnapshot } from "../shared/contracts/vault";

type ChooseVaultResult =
  { cancelled: true } | { cancelled: false; snapshot: VaultSnapshot };

contextBridge.exposeInMainWorld("brainarium", {
  chooseVault: (): Promise<ChooseVaultResult> =>
    ipcRenderer.invoke("vault:choose"),
});

export type BrainariumApi = {
  chooseVault(): Promise<ChooseVaultResult>;
};
