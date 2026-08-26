import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { readVaultImage } from "./vault-image-reader";
import { scanVault } from "./vault-scanner";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-image-"));
  temporaryRoots.push(directory);
  return directory;
}

async function vaultWithNote(): Promise<string> {
  const root = await temporaryDirectory();
  await writeFile(path.join(root, "note.md"), "# Note\n");
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("readVaultImage", () => {
  it("returns verified bytes for a local PNG next to a Markdown note", async () => {
    const root = await vaultWithNote();
    await writeFile(
      path.join(root, "image.png"),
      Buffer.from("89504e470d0a1a0a00000000", "hex"),
    );

    await expect(
      readVaultImage(await scanVault(root), {
        assetPath: "image.png",
        sourceRelativePath: "note.md",
      }),
    ).resolves.toMatchObject({ mimeType: "image/png" });
  });

  it("rejects a traversal path and Brainarium's derived directory", async () => {
    const root = await vaultWithNote();
    await writeFile(
      path.join(root, "safe.png"),
      Buffer.from("89504e470d0a1a0a00000000", "hex"),
    );
    await expect(
      readVaultImage(await scanVault(root), {
        assetPath: "../safe.png",
        sourceRelativePath: "note.md",
      }),
    ).rejects.toThrow("leaves the current vault path");
    await expect(
      readVaultImage(await scanVault(root), {
        assetPath: ".brainarium/graph.png",
        sourceRelativePath: "note.md",
      }),
    ).rejects.toThrow("outside the visible vault");
  });

  it("rejects unsupported signatures and symlinks that leave the vault", async () => {
    const root = await vaultWithNote();
    const outside = await temporaryDirectory();
    await writeFile(path.join(root, "not-an-image.png"), "not an image");
    await writeFile(
      path.join(outside, "outside.png"),
      Buffer.from("89504e470d0a1a0a00000000", "hex"),
    );
    await symlink(
      path.join(outside, "outside.png"),
      path.join(root, "outside.png"),
    );
    const snapshot = await scanVault(root);

    await expect(
      readVaultImage(snapshot, {
        assetPath: "not-an-image.png",
        sourceRelativePath: "note.md",
      }),
    ).rejects.toThrow("does not match");
    await expect(
      readVaultImage(snapshot, {
        assetPath: "outside.png",
        sourceRelativePath: "note.md",
      }),
    ).rejects.toThrow("outside the visible vault");
  });
});
