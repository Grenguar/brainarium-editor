import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readVaultPdfDocument } from "./vault-pdf-reader";
import { scanVault } from "./vault-scanner";

const roots: string[] = [];
const temporaryDirectory = async (): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "brainarium-pdf-"));
  roots.push(root);
  return root;
};

afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  ),
);

describe("readVaultPdfDocument", () => {
  it("returns verified PDF bytes without exposing a filesystem path", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "paper.pdf"), "%PDF-1.7\nfixture\n");

    const document = await readVaultPdfDocument(
      await scanVault(root),
      "paper.pdf",
    );

    expect(document).toMatchObject({
      kind: "pdf",
      relativePath: "paper.pdf",
      text: "",
      title: "paper",
    });
    expect(document.pdf?.mimeType).toBe("application/pdf");
    expect(Buffer.from(document.pdf?.bytes ?? []).toString("ascii")).toBe(
      "%PDF-1.7\nfixture\n",
    );
  });

  it("rejects an indexed .pdf file without a PDF signature", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "paper.pdf"), "not a PDF");

    await expect(
      readVaultPdfDocument(await scanVault(root), "paper.pdf"),
    ).rejects.toThrow("does not match its PDF type");
  });
});
