import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => os.tmpdir() },
  BrowserWindow: { getFocusedWindow: () => undefined },
  dialog: { showSaveDialog: vi.fn(async () => ({ canceled: true })) },
}));

import { dialog } from "electron";

import { scanVault } from "../vault/vault-scanner";
import { exportDocumentToPdf } from "./document-pdf-export";

const temporaryRoots: string[] = [];

async function temporaryVault(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-export-"));
  temporaryRoots.push(directory);
  return directory;
}

afterEach(async () => {
  vi.mocked(dialog.showSaveDialog).mockClear();
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("exportDocumentToPdf", () => {
  it("reports a missing file rather than throwing", async () => {
    const root = await temporaryVault();
    await writeFile(path.join(root, "plan.md"), "# Plan\n");
    const snapshot = await scanVault(root);

    await expect(exportDocumentToPdf(snapshot, "absent.md")).resolves.toEqual({
      relativePath: "absent.md",
      status: "missing",
    });
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  it("refuses kinds that carry bytes rather than text", async () => {
    const root = await temporaryVault();
    await writeFile(
      path.join(root, "shot.png"),
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL6owAAAABJRU5ErkJggg==",
        "base64",
      ),
    );
    const snapshot = await scanVault(root);

    await expect(exportDocumentToPdf(snapshot, "shot.png")).resolves.toEqual({
      kind: "image",
      status: "unsupported",
    });
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  it("treats a cancelled save dialog as an outcome, not a failure", async () => {
    const root = await temporaryVault();
    await writeFile(path.join(root, "plan.md"), "# Plan\n");
    const snapshot = await scanVault(root);

    await expect(exportDocumentToPdf(snapshot, "plan.md")).resolves.toEqual({
      status: "cancelled",
    });
    expect(dialog.showSaveDialog).toHaveBeenCalledTimes(1);
  });
});
