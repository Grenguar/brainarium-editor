import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  importVaultImage,
  readVaultImage,
  readVaultImageDocument,
} from "./vault-image-reader";
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

  it("allows a relative path inside the vault but rejects paths outside it and the derived directory", async () => {
    const root = await vaultWithNote();
    await mkdir(path.join(root, "notes"));
    await writeFile(path.join(root, "notes", "note.md"), "# Nested note\n");
    await mkdir(path.join(root, "images"));
    await writeFile(
      path.join(root, "images", "safe.png"),
      Buffer.from("89504e470d0a1a0a00000000", "hex"),
    );
    await expect(
      readVaultImage(await scanVault(root), {
        assetPath: "../images/safe.png",
        sourceRelativePath: "notes/note.md",
      }),
    ).resolves.toMatchObject({ mimeType: "image/png" });
    await expect(
      readVaultImage(await scanVault(root), {
        assetPath: "../../../../safe.png",
        sourceRelativePath: "notes/note.md",
      }),
    ).rejects.toThrow("outside the visible vault");
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

describe("readVaultImageDocument", () => {
  it("reads a verified indexed image without exposing a filesystem path", async () => {
    const root = await vaultWithNote();
    await writeFile(
      path.join(root, "image.png"),
      Buffer.from("89504e470d0a1a0a00000000", "hex"),
    );

    await expect(
      readVaultImageDocument(await scanVault(root), "image.png"),
    ).resolves.toMatchObject({
      image: { mimeType: "image/png" },
      kind: "image",
      relativePath: "image.png",
      text: "",
    });
  });
});

describe("importVaultImage", () => {
  it("moves a verified image into the note's structured image directory and reuses identical bytes", async () => {
    const root = await temporaryDirectory();
    await mkdir(path.join(root, "notes", "ai"), { recursive: true });
    await writeFile(path.join(root, "notes", "ai", "llms.md"), "# LLMs\n");
    const picked = path.join(await temporaryDirectory(), "chart.png");
    const bytes = Buffer.from("89504e470d0a1a0a00000000", "hex");
    await writeFile(picked, bytes);
    const snapshot = await scanVault(root);

    await expect(
      importVaultImage(snapshot, "notes/ai/llms.md", picked),
    ).resolves.toEqual({
      markdown: "![chart](../../images/notes/ai/chart.png)",
      relativePath: "images/notes/ai/chart.png",
    });
    await expect(
      readFile(path.join(root, "images", "notes", "ai", "chart.png")),
    ).resolves.toEqual(bytes);
    await expect(readFile(picked)).rejects.toMatchObject({ code: "ENOENT" });

    const duplicate = path.join(await temporaryDirectory(), "chart.png");
    await writeFile(duplicate, bytes);
    await expect(
      importVaultImage(snapshot, "notes/ai/llms.md", duplicate),
    ).resolves.toMatchObject({
      relativePath: "images/notes/ai/chart.png",
    });
    await expect(readFile(duplicate)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
