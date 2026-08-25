import { app, BrowserWindow, dialog, ipcMain } from "electron";

import { scanVault } from "./vault/vault-scanner";

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

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

  return { cancelled: false, snapshot: await scanVault(result.filePaths[0]) };
});

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
