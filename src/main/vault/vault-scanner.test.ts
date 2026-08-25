import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { isSupportedVaultDocument, scanVault } from "./vault-scanner";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-vault-"));
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

describe("scanVault", () => {
  it("indexes supported documents in a deterministic, nested tree", async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, "notes"));
    await writeFile(path.join(root, "z.csv"), "name,value\\nalpha,1\\n");
    await writeFile(path.join(root, "notes", "Alpha.MD"), "# Alpha\\n");
    await writeFile(path.join(root, "notes", "ignore.txt"), "not a document");
    await mkdir(path.join(root, ".git"));
    await writeFile(path.join(root, ".git", "internal.md"), "# ignored");
    await writeFile(path.join(root, ".hidden.md"), "# ignored");

    const snapshot = await scanVault(root);

    expect(
      snapshot.documents.map((document) => [
        document.relativePath,
        document.kind,
        document.title,
      ]),
    ).toEqual([
      ["notes/Alpha.MD", "markdown", "Alpha"],
      ["z.csv", "csv", "z"],
    ]);
    expect(snapshot.tree.children.map((child) => child.relativePath)).toEqual([
      "notes",
      "z.csv",
    ]);
    expect(snapshot.issues).toEqual([]);
  });

  it("keeps allowed symlink paths logical and excludes external targets", async () => {
    const root = await temporaryDirectory();
    const externalRoot = await temporaryDirectory();
    await mkdir(path.join(root, "actual"));
    await writeFile(path.join(root, "actual", "inside.md"), "# inside");
    await writeFile(path.join(externalRoot, "outside.md"), "# outside");
    await symlink(path.join(root, "actual"), path.join(root, "linked-notes"));
    await symlink(externalRoot, path.join(root, "outside-link"));

    const snapshot = await scanVault(root);

    expect(snapshot.documents.map((document) => document.relativePath)).toEqual(
      ["actual/inside.md", "linked-notes/inside.md"],
    );
    expect(snapshot.issues).toEqual([
      { code: "external-symlink", relativePath: "outside-link" },
    ]);
  });

  it("does not recurse through symlink cycles", async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, "nested"));
    await writeFile(path.join(root, "nested", "note.md"), "# note");
    await symlink(root, path.join(root, "nested", "again"));

    const snapshot = await scanVault(root);

    expect(snapshot.documents.map((document) => document.relativePath)).toEqual(
      ["nested/note.md"],
    );
    expect(snapshot.issues).toEqual([
      { code: "symlink-cycle", relativePath: "nested/again" },
    ]);
  });
});

describe("isSupportedVaultDocument", () => {
  it.each(["note.md", "note.MARKDOWN", "table.CsV"])(
    "accepts %s",
    (fileName) => {
      expect(isSupportedVaultDocument(fileName)).toBe(true);
    },
  );

  it.each(["note.txt", ".md", "archive.md.bak"])("rejects %s", (fileName) => {
    expect(isSupportedVaultDocument(fileName)).toBe(false);
  });
});
