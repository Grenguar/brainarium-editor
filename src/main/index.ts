import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";

import { GraphifyService } from "./graphify/graphify-service";
import { RecentVaultStore } from "./vault/recent-vaults";
import { buildVaultLinkGraph } from "./vault/vault-link-graph";
import { searchVault } from "./vault/vault-search";
import { scanVault } from "./vault/vault-scanner";
import { readVaultDocument, saveVaultDocument } from "./vault/vault-reader";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let activeVault: Awaited<ReturnType<typeof scanVault>> | undefined;

const recentVaults = (): RecentVaultStore =>
  new RecentVaultStore(app.getPath("userData") + "/recent-vaults.json");

const graphify = (): GraphifyService =>
  new GraphifyService(
    process.env.BRAINARIUM_GRAPHIFY_BIN ?? "graphify-rs",
    app.getPath("userData") + "/graphify",
  );

async function openVault(
  vaultPath: string,
): Promise<Awaited<ReturnType<typeof scanVault>>> {
  const snapshot = await scanVault(vaultPath);
  await recentVaults().remember(snapshot.rootPath);
  activeVault = snapshot;
  return snapshot;
}

const createWindow = (): void => {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
};

ipcMain.handle("vault:choose", async (): Promise<unknown> => {
  const result = await dialog.showOpenDialog({
    buttonLabel: "Open vault",
    properties: ["openDirectory"],
    title: "Choose a Brainarium vault",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { cancelled: true };
  }

  return { cancelled: false, snapshot: await openVault(result.filePaths[0]) };
});

ipcMain.handle("vault:listRecent", async (): Promise<unknown> =>
  recentVaults().list(),
);

ipcMain.handle(
  "vault:openRecent",
  async (_event, id: unknown): Promise<unknown> => {
    if (typeof id !== "string") {
      throw new Error("Choose a valid recent vault.");
    }
    const vaultPath = await recentVaults().pathFor(id);
    if (!vaultPath) {
      throw new Error("That recent vault is no longer available.");
    }
    return openVault(vaultPath);
  },
);

ipcMain.handle(
  "document:save",
  async (_event, input: unknown): Promise<unknown> => {
    if (!activeVault || !isSaveInput(input)) {
      throw new Error("No valid document save is available.");
    }
    return saveVaultDocument(activeVault, input);
  },
);

ipcMain.handle("graphify:build", async (): Promise<unknown> => {
  if (!activeVault) throw new Error("Open a vault before building its graph.");
  return graphify().build(activeVault);
});

ipcMain.handle("vault:linkGraph", async (): Promise<unknown> => {
  if (!activeVault) throw new Error("Open a vault before viewing its graph.");
  return buildVaultLinkGraph(activeVault);
});

ipcMain.handle(
  "vault:search",
  async (_event, query: unknown): Promise<unknown> => {
    if (!activeVault || typeof query !== "string") {
      throw new Error("Open a vault and enter a search query.");
    }
    return searchVault(activeVault, query);
  },
);

ipcMain.handle(
  "document:read",
  async (_event, relativePath: unknown): Promise<unknown> => {
    if (typeof relativePath !== "string" || !activeVault) {
      throw new Error("No active vault document is available.");
    }
    return readVaultDocument(activeVault, relativePath);
  },
);

ipcMain.handle(
  "document:copyContent",
  async (_event, relativePath: unknown): Promise<void> => {
    if (typeof relativePath !== "string" || !activeVault) {
      throw new Error("No active vault document is available.");
    }
    const document = await readVaultDocument(activeVault, relativePath);
    clipboard.writeText(document.text);
  },
);

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function isSaveInput(
  value: unknown,
): value is { baseVersion: string; relativePath: string; text: string } {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return ["baseVersion", "relativePath", "text"].every(
    (key) => typeof input[key] === "string",
  );
}
