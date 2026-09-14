import path from "node:path";

import { isPathInside } from "../security/vault-paths";

/**
 * Picks the vault a file should be read in.
 *
 * When several known vaults contain the file — a vault nested inside another,
 * or a folder opened at two different depths — the deepest one wins, because
 * that is the vault whose contents the file actually belongs to.
 *
 * Roots and the file path must already be resolved real paths; comparing
 * unresolved paths would let a symlinked vault miss its own file.
 */
export const vaultForFile = (
  vaultRoots: readonly string[],
  filePath: string,
): string | undefined => {
  let best: string | undefined;
  for (const root of vaultRoots) {
    if (root === filePath) continue;
    if (!isPathInside(root, filePath)) continue;
    if (best === undefined || root.length > best.length) best = root;
  }
  return best;
};

/**
 * The vault-relative path a file would have inside the given root, in the
 * forward-slash form the scanner and every reader use.
 */
export const relativePathIn = (rootPath: string, filePath: string): string =>
  path.relative(rootPath, filePath).split(path.sep).join("/");
