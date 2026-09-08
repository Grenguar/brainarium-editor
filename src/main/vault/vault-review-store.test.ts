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
});
