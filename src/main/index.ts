import { access } from "node:fs/promises";
import path from "node:path";

import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import squirrelStartup from "electron-squirrel-startup";

import { RustIndexerService } from "./indexer/rust-indexer-service";
import { RecentVaultStore } from "./vault/recent-vaults";
import { searchVault } from "./vault/vault-search";
import { scanVault } from "./vault/vault-scanner";
import { readVaultDocument, saveVaultDocument } from "./vault/vault-reader";
import { VaultWatcher } from "./vault/vault-watcher";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let activeVault: Awaited<ReturnType<typeof scanVault>> | undefined;
let mainWindow: BrowserWindow | undefined;
let vaultWatcher: VaultWatcher | undefined;
let graphRebuildGeneration = 0;

const appDescription = "A local-first editor for the files you already trust.";

const appInfo = () => ({
  description: appDescription,
  name: app.getName(),
  version: app.getVersion(),
});

// Squirrel starts the app only to create or remove its Windows shortcut.
// Quitting immediately keeps normal startup and installer maintenance separate.
if (squirrelStartup) {
  app.quit();
}

const recentVaults = (): RecentVaultStore =>
  new RecentVaultStore(app.getPath("userData") + "/recent-vaults.json");

const indexer = (): RustIndexerService =>
  new RustIndexerService(
    process.env.BRAINARIUM_INDEXER_BIN ??
      (app.isPackaged
        ? path.join(process.resourcesPath, "brainarium-indexer")
        : path.join(
            app.getAppPath(),
            "rust",
            "target",
            "release",
            "brainarium-indexer",
          )),
  );

const markdownFingerprint = (
  snapshot: Awaited<ReturnType<typeof scanVault>>,
): string =>
  snapshot.documents
    .filter((document) => document.kind === "markdown")
    .map(
      (document) =>
        `${document.relativePath}\u0000${document.mtimeMs}\u0000${document.size}`,
    )
    .join("\n");

async function refreshCachedGraphAfterMarkdownChange(
  previousSnapshot: Awaited<ReturnType<typeof scanVault>> | undefined,
  nextSnapshot: Awaited<ReturnType<typeof scanVault>>,
): Promise<void> {
  if (
    !previousSnapshot ||
    previousSnapshot.rootPath !== nextSnapshot.rootPath ||
    markdownFingerprint(previousSnapshot) === markdownFingerprint(nextSnapshot)
  ) {
    return;
  }

  try {
    await access(
      path.join(nextSnapshot.rootPath, ".brainarium", "graph-v1.json"),
    );
  } catch {
    return;
  }

  const generation = ++graphRebuildGeneration;
  try {
    const graph = await indexer().build(nextSnapshot);
    if (
      generation === graphRebuildGeneration &&
      activeVault?.rootPath === nextSnapshot.rootPath
    ) {
      mainWindow?.webContents.send("vault:graphChanged", graph);
    }
  } catch {
    // The tree refresh still succeeds if an optional derived graph cannot.
  }
}

async function openVault(
  vaultPath: string,
): Promise<Awaited<ReturnType<typeof scanVault>>> {
  const snapshot = await scanVault(vaultPath);
  await recentVaults().remember(snapshot.rootPath);
  activeVault = snapshot;
  vaultWatcher?.start(snapshot);
  return snapshot;
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: `${app.getName()} ${app.getVersion()}`,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event) => {
    event.preventDefault();
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
  void mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
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

ipcMain.handle("app:info", (): ReturnType<typeof appInfo> => appInfo());

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

ipcMain.handle("vault:linkGraph", async (): Promise<unknown> => {
  if (!activeVault) throw new Error("Open a vault before viewing its graph.");
  return indexer().build(activeVault);
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
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    copyright: "Copyright © 2026 Brainarium contributors",
    version: `v${app.getVersion()}`,
  });
  vaultWatcher = new VaultWatcher((snapshot) => {
    const previousSnapshot = activeVault;
    activeVault = snapshot;
    mainWindow?.webContents.send("vault:changed", snapshot);
    void refreshCachedGraphAfterMarkdownChange(previousSnapshot, snapshot);
  });
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

app.on("before-quit", () => {
  vaultWatcher?.stop();
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
