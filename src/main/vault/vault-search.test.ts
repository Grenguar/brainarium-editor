import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { searchVault } from "./vault-search";
import { scanVault } from "./vault-scanner";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  ),
);

describe("searchVault", () => {
  it("finds supported document text and returns bounded snippets", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "brainarium-search-"));
    roots.push(root);
    await writeFile(
      path.join(root, "alpha.md"),
      "# Alpha\nA useful needle appears twice: needle.",
    );
    await writeFile(path.join(root, "other.txt"), "No match.");

    const results = await searchVault(await scanVault(root), "needle");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      matches: 2,
      relativePath: "alpha.md",
      title: "alpha",
    });
  });
});
