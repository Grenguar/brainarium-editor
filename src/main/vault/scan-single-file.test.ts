import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { scanSingleFile } from "./vault-scanner";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-single-"));
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

describe("scanSingleFile", () => {
  it("lists only the opened file, never its neighbours", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "README.md"), "# Readme\n");
    await writeFile(path.join(root, "other.md"), "# Other\n");
    await mkdir(path.join(root, "nested"));
    await writeFile(path.join(root, "nested", "deep.md"), "# Deep\n");

    const snapshot = await scanSingleFile(path.join(root, "README.md"));

    expect(snapshot?.documents).toHaveLength(1);
    expect(snapshot?.documents[0]).toMatchObject({
      kind: "markdown",
      name: "README.md",
      relativePath: "README.md",
    });
    expect(snapshot?.tree.children).toHaveLength(1);
  });

  it("roots the snapshot at the file's own folder", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "notes.csv"), "a,b\n1,2\n");

    const snapshot = await scanSingleFile(path.join(root, "notes.csv"));

    expect(snapshot?.rootPath).toBe(await realpath(root));
    expect(snapshot?.documents[0].kind).toBe("csv");
  });

  it("refuses a kind the vault does not support", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "archive.zip"), "not a document");

    await expect(
      scanSingleFile(path.join(root, "archive.zip")),
    ).resolves.toBeUndefined();
  });

  it("refuses a directory", async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, "folder.md"));

    await expect(
      scanSingleFile(path.join(root, "folder.md")),
    ).resolves.toBeUndefined();
  });
});
