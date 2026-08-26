import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { VaultSessionStore } from "./vault-session-state";

const temporaryRoots: string[] = [];

async function storeForTest(): Promise<{
  storagePath: string;
  store: VaultSessionStore;
}> {
  const root = await mkdtemp(path.join(os.tmpdir(), "brainarium-session-"));
  temporaryRoots.push(root);
  const storagePath = path.join(root, "session.json");
  return { storagePath, store: new VaultSessionStore(storagePath) };
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("VaultSessionStore", () => {
  it("persists document and per-document scroll state for the current vault", async () => {
    const { store } = await storeForTest();
    await store.rememberVault("/vaults/brain");
    await store.rememberSession("/vaults/brain", {
      activeDocumentPath: "notes/plan.md",
      scrollPositions: { "notes/plan.md": 420 },
    });

    await expect(store.restore()).resolves.toEqual({
      activeDocumentPath: "notes/plan.md",
      scrollPositions: { "notes/plan.md": 420 },
      vaultPath: "/vaults/brain",
    });
  });

  it("does not allow an old vault renderer to overwrite the selected vault", async () => {
    const { store } = await storeForTest();
    await store.rememberVault("/vaults/one");
    await store.rememberVault("/vaults/two");
    await store.rememberSession("/vaults/one", {
      activeDocumentPath: "stale.md",
      scrollPositions: { "stale.md": 12 },
    });

    await expect(store.restore()).resolves.toEqual({
      scrollPositions: {},
      vaultPath: "/vaults/two",
    });
  });

  it("treats malformed persisted state as an empty session", async () => {
    const { storagePath, store } = await storeForTest();
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        storagePath,
        JSON.stringify({ scrollPositions: { "a.md": -1 } }),
      ),
    );

    await expect(store.restore()).resolves.toEqual({ scrollPositions: {} });
  });
});
