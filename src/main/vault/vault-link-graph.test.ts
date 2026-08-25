import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { buildVaultLinkGraph } from "./vault-link-graph";
import { scanVault } from "./vault-scanner";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(
    roots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  ),
);

describe("buildVaultLinkGraph", () => {
  it("uses resolved wiki-links only and does not invent edges", async () => {
    const root = await mkdtemp(
      path.join(os.tmpdir(), "brainarium-link-graph-"),
    );
    roots.push(root);
    await mkdir(path.join(root, "nested"));
    await writeFile(
      path.join(root, "alpha.md"),
      "See [[beta#heading]] and [[nested/gamma|A linked note]] and [[missing]].",
    );
    await writeFile(path.join(root, "beta.md"), "# Beta");
    await writeFile(path.join(root, "nested", "gamma.markdown"), "# Gamma");

    expect((await buildVaultLinkGraph(await scanVault(root))).edges).toEqual([
      { source: "alpha.md", target: "beta.md" },
      { source: "alpha.md", target: "nested/gamma.markdown" },
    ]);
  });
});
