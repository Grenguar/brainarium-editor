import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { RecentVaultStore } from "./recent-vaults";

const temporaryRoots: string[] = [];

async function storeForTest(): Promise<RecentVaultStore> {
  const root = await mkdtemp(path.join(os.tmpdir(), "brainarium-recents-"));
  temporaryRoots.push(root);
  return new RecentVaultStore(path.join(root, "recents.json"));
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("RecentVaultStore", () => {
  it("persists recent vault metadata without exposing stored paths", async () => {
    const store = await storeForTest();
    await store.remember("/vaults/brain");

    const [recent] = await store.list();

    expect(recent).toMatchObject({ name: "brain" });
    expect("path" in recent).toBe(false);
    await expect(store.pathFor(recent.id)).resolves.toBe("/vaults/brain");
  });

  it("moves a reopened vault to the top instead of duplicating it", async () => {
    const store = await storeForTest();
    await store.remember("/vaults/one");
    await store.remember("/vaults/two");
    await store.remember("/vaults/one");

    expect((await store.list()).map((recent) => recent.name)).toEqual([
      "one",
      "two",
    ]);
  });
});
