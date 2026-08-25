import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readVaultDocument } from "./vault-reader";
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
});
