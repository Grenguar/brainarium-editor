import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readVaultDocument, saveVaultDocument } from "./vault-reader";
import { scanVault } from "./vault-scanner";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-reader-"));
  temporaryRoots.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("readVaultDocument", () => {
  it("returns exact UTF-8 source for a document from the active snapshot", async () => {
    const root = await temporaryDirectory();
    await writeFile(
      path.join(root, "note.md"),
      "# Retain this\n\nUntouched source.\n",
    );

    const content = await readVaultDocument(await scanVault(root), "note.md");

    expect(content.text).toBe("# Retain this\n\nUntouched source.\n");
    expect(content.title).toBe("note");
  });

  it("refuses files that are not documents in the active snapshot", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "note.md"), "# Note\n");
    await writeFile(path.join(root, "secret.pdf"), "not a document\n");

    await expect(
      readVaultDocument(await scanVault(root), "secret.pdf"),
    ).rejects.toThrow("not part of the active vault");
  });

  it("rejects invalid UTF-8 rather than silently coercing source", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "broken.md"), Buffer.from([0xff, 0xfe]));

    await expect(
      readVaultDocument(await scanVault(root), "broken.md"),
    ).rejects.toThrow("only opens UTF-8");
  });

  it("atomically saves a document only when its version is current", async () => {
    const root = await temporaryDirectory();
    const notePath = path.join(root, "note.md");
    await writeFile(notePath, "# Before\n");
    const snapshot = await scanVault(root);
    const before = await readVaultDocument(snapshot, "note.md");

    const saved = await saveVaultDocument(snapshot, {
      baseVersion: before.version,
      relativePath: "note.md",
      text: "# After\n",
    });

    await expect(readFile(notePath, "utf8")).resolves.toBe("# After\n");
    expect(saved.version).not.toBe(before.version);
  });

  it("blocks a save when another editor changed the document", async () => {
    const root = await temporaryDirectory();
    const notePath = path.join(root, "note.md");
    await writeFile(notePath, "# Before\n");
    const snapshot = await scanVault(root);
    const before = await readVaultDocument(snapshot, "note.md");
    await writeFile(notePath, "# External\n");

    await expect(
      saveVaultDocument(snapshot, {
        baseVersion: before.version,
        relativePath: "note.md",
        text: "# Mine\n",
      }),
    ).rejects.toThrow("changed outside Brainarium");
  });
});
