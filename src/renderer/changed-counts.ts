import type {
  VaultTreeDirectory,
  VaultTreeNode,
} from "../shared/contracts/vault";

/**
 * Counts changed descendants for every directory in one post-order walk.
 *
 * The tree previously answered "does this subtree contain a changed file?" from
 * inside each rendered node, which re-walked the same subtrees once per node.
 * Deriving the whole map once keeps the badge and the per-file dot reading from
 * a single pass over the renderer's current tree.
 *
 * Changed paths that are absent from the tree contribute nothing, so a file
 * deleted between a reconcile and a render is simply not counted.
 */
export const changedCounts = (
  tree: VaultTreeDirectory,
  changedPaths: ReadonlySet<string>,
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();

  const walk = (node: VaultTreeNode): number => {
    if (node.kind !== "directory") {
      return changedPaths.has(node.relativePath) ? 1 : 0;
    }
    let total = 0;
    for (const child of node.children) total += walk(child);
    counts.set(node.relativePath, total);
    return total;
  };

  walk(tree);
  return counts;
};
