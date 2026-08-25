import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { scanVault } from "./vault-scanner";
import { isDerivedGraphPath, VaultWatcher } from "./vault-watcher";

const temporaryRoots: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "brainarium-watch-"));
  temporaryRoots.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { force: true, recursive: true })),
  );
});

describe("VaultWatcher", () => {
  it("reconciles a changed vault and stops cleanly", async () => {
    const root = await temporaryDirectory();
    await writeFile(path.join(root, "before.md"), "# Before\n");
    const changed = vi.fn();
    const watcher = new VaultWatcher(changed, scanVault, {
      debounceMs: 5,
      reconcileMs: 20,
    });

    watcher.start(await scanVault(root));
    await writeFile(path.join(root, "after.md"), "# After\n");

    await vi.waitFor(() => {
      expect(changed).toHaveBeenCalled();
      expect(changed.mock.calls.at(-1)?.[0].documents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ relativePath: "after.md" }),
        ]),
      );
    });
    watcher.stop();
  });

  it("does not re-index its own derived graph cache", async () => {
    expect(isDerivedGraphPath(".brainarium/graph-v1.json")).toBe(true);
    expect(isDerivedGraphPath(Buffer.from(".brainarium/graph-v1.json"))).toBe(
      true,
    );
    expect(isDerivedGraphPath("notes/alpha.md")).toBe(false);
  });
});
