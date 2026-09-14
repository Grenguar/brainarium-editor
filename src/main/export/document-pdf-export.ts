import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { BrowserWindow, dialog, app } from "electron";

import type {
  DocumentExportResult,
  VaultSnapshot,
} from "../../shared/contracts/vault";
import { hasTextContent } from "../../shared/documents";
import { readVaultImage } from "../vault/vault-image-reader";
import { readVaultDocument } from "../vault/vault-reader";
import { type InlineImage, buildPrintDocument } from "./export-html";

/** Base64 inflates by about a third, and every inlined byte lands in the temp
 * file and again in the print window's DOM. */
const MAX_INLINE_IMAGE_BYTES = 20 * 1024 * 1024;
const PRINT_TIMEOUT_MS = 30_000;

/**
 * One export at a time. A double-click would otherwise open a second hidden
 * window and race for the same destination.
 */
let exportInFlight = false;

const isLocalAsset = (source: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:/i.test(source) && !source.startsWith("//");

/**
 * Resolves image references through the existing vault image reader, which
 * already enforces containment, size, extension, and content signature, so the
 * exporter adds no new filesystem trust surface.
 */
const imageResolver = (
  snapshot: VaultSnapshot,
  sourceRelativePath: string,
): InlineImage => {
  let inlinedBytes = 0;
  return async (source) => {
    if (!isLocalAsset(source)) return undefined;
    if (inlinedBytes >= MAX_INLINE_IMAGE_BYTES) return undefined;
    const image = await readVaultImage(snapshot, {
      assetPath: decodeURIComponent(source),
      sourceRelativePath,
    });
    if (inlinedBytes + image.bytes.byteLength > MAX_INLINE_IMAGE_BYTES) {
      return undefined;
    }
    inlinedBytes += image.bytes.byteLength;
    return `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`;
  };
};

/**
 * Renders the generated HTML in a hidden window with scripting disabled.
 *
 * The guards installed on the main window do not apply here: window-open and
 * navigation handlers are per-webContents, so this window installs its own.
 */
const renderPdf = async (htmlPath: string): Promise<Buffer> => {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      images: true,
      javascript: false,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  try {
    printWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    printWindow.webContents.on("will-navigate", (event) => {
      event.preventDefault();
    });

    await printWindow.loadFile(htmlPath);
    const printed = printWindow.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
    });
    const timeout = new Promise<never>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error("Brainarium could not finish this export.")),
        PRINT_TIMEOUT_MS,
      ),
    );
    return await Promise.race([printed, timeout]);
  } finally {
    printWindow.destroy();
  }
};

/**
 * Exports one saved vault document to a PDF the user chooses a location for.
 *
 * The destination is intentionally outside the vault, so the containment
 * checks that guard every read deliberately do not apply to it. Only the
 * chosen file's basename is returned; the absolute path stays in main.
 */
export async function exportDocumentToPdf(
  snapshot: VaultSnapshot,
  relativePath: string,
  parent?: BrowserWindow,
): Promise<DocumentExportResult> {
  if (exportInFlight) return { status: "busy" };

  const listed = snapshot.documents.find(
    (candidate) => candidate.relativePath === relativePath,
  );
  if (!listed) return { relativePath, status: "missing" };
  if (!hasTextContent(listed.kind)) {
    return { kind: listed.kind, status: "unsupported" };
  }

  exportInFlight = true;
  let temporaryDirectory: string | undefined;
  try {
    let document;
    try {
      document = await readVaultDocument(snapshot, relativePath);
    } catch {
      return { relativePath, status: "missing" };
    }

    const options = {
      defaultPath: path.join(
        app.getPath("downloads"),
        `${document.title.replace(/[/\\]/g, "-")}.pdf`,
      ),
      filters: [{ extensions: ["pdf"], name: "PDF" }],
      title: "Export to PDF",
    };
    // Passing the owner window presents the dialog as a sheet on macOS.
    const owner = parent ?? BrowserWindow.getFocusedWindow();
    const chosen = owner
      ? await dialog.showSaveDialog(owner, options)
      : await dialog.showSaveDialog(options);
    if (chosen.canceled || !chosen.filePath) return { status: "cancelled" };

    const html = await buildPrintDocument(
      document,
      imageResolver(snapshot, relativePath),
    );

    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "brainarium-export-"),
    );
    const htmlPath = path.join(temporaryDirectory, "export.html");
    await writeFile(htmlPath, html, "utf8");

    await writeFile(chosen.filePath, await renderPdf(htmlPath));
    return { fileName: path.basename(chosen.filePath), status: "exported" };
  } finally {
    exportInFlight = false;
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  }
}
