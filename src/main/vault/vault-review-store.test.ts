import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { scanVault } from "./vault-scanner";
import { VaultReviewStore } from "./vault-review-store";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-review-"));
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

describe("VaultReviewStore", () => {
  it("preserves the last reviewed Markdown text across an external change and relaunch", async () => {
    const root = await temporaryDirectory();
    const note = path.join(root, "plan.md");
    const storage = path.join(await temporaryDirectory(), "review.json");
    await writeFile(note, "The plan has a calm review step.\n");

    const store = new VaultReviewStore(storage);
    const initialSnapshot = await scanVault(root);
    await store.reconcile(initialSnapshot);
    await writeFile(note, "The plan has an explicit review step.\n");
    const changedSnapshot = await scanVault(root);
    const changed = await store.reconcile(changedSnapshot);

    expect(changed).toEqual([
      expect.objectContaining({ changed: true, relativePath: "plan.md" }),
    ]);
    await expect(
      store.review(changedSnapshot.rootPath, "plan.md"),
    ).resolves.toMatchObject({
      currentText: "The plan has an explicit review step.\n",
      previousText: "The plan has a calm review step.\n",
    });

    const relaunched = new VaultReviewStore(storage);
    await expect(relaunched.states(changedSnapshot.rootPath)).resolves.toEqual(
      changed,
    );
    await relaunched.markReviewed(changedSnapshot.rootPath, "plan.md");
    await expect(relaunched.states(changedSnapshot.rootPath)).resolves.toEqual(
      [],
    );
  });

  it("serializes a watcher reconciliation with marking a changed note reviewed", async () => {
    const root = await temporaryDirectory();
    const note = path.join(root, "plan.md");
    const storage = path.join(await temporaryDirectory(), "review.json");
    await writeFile(note, "First draft.\n");

    const store = new VaultReviewStore(storage);
    await store.reconcile(await scanVault(root));
    await writeFile(note, "Reviewed revision.\n");
    const changedSnapshot = await scanVault(root);

    await Promise.all([
      store.reconcile(changedSnapshot),
      store.markReviewed(changedSnapshot.rootPath, "plan.md"),
    ]);

    await expect(store.states(changedSnapshot.rootPath)).resolves.toEqual([]);
    await expect(
      store.review(changedSnapshot.rootPath, "plan.md"),
    ).resolves.toBeUndefined();
  });

  it("clears every changed marker in the vault when marking all reviewed", async () => {
    const root = await temporaryDirectory();
    const storage = path.join(await temporaryDirectory(), "review.json");
    await writeFile(path.join(root, "plan.md"), "First draft.\n");
    await writeFile(path.join(root, "notes.md"), "Early notes.\n");

    const store = new VaultReviewStore(storage);
    await store.reconcile(await scanVault(root));
    await writeFile(path.join(root, "plan.md"), "Revised plan.\n");
    await writeFile(path.join(root, "notes.md"), "Revised notes.\n");
    const changedSnapshot = await scanVault(root);
    await store.reconcile(changedSnapshot);

    const vaultPath = changedSnapshot.rootPath;
    await expect(store.states(vaultPath)).resolves.toHaveLength(2);
    await expect(store.markAllReviewed(vaultPath)).resolves.toEqual([]);
    await expect(store.states(vaultPath)).resolves.toEqual([]);
    await expect(store.review(vaultPath, "plan.md")).resolves.toBeUndefined();
    await expect(store.review(vaultPath, "notes.md")).resolves.toBeUndefined();
  });

  it("serializes marking every note reviewed against a concurrent reconciliation", async () => {
    const root = await temporaryDirectory();
    const note = path.join(root, "plan.md");
    const storage = path.join(await temporaryDirectory(), "review.json");
    await writeFile(note, "First draft.\n");

    const store = new VaultReviewStore(storage);
    await store.reconcile(await scanVault(root));
    await writeFile(note, "Reviewed revision.\n");
    const changedSnapshot = await scanVault(root);

    await Promise.all([
      store.reconcile(changedSnapshot),
      store.markAllReviewed(changedSnapshot.rootPath),
    ]);

    await expect(store.states(changedSnapshot.rootPath)).resolves.toEqual([]);
  });

  it("returns no changes when marking all reviewed for an unknown vault", async () => {
    const storage = path.join(await temporaryDirectory(), "review.json");
    const store = new VaultReviewStore(storage);

    await expect(store.markAllReviewed("/nowhere")).resolves.toEqual([]);
  });
});
