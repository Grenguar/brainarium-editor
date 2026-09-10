import path from "node:path";

/**
 * True when `candidatePath` is the root itself or sits beneath it.
 *
 * Four vault readers each carry a private copy of this check. This is its
 * intended home; the existing copies are deliberately left in place, because
 * changing four security-critical readers belongs in its own change rather
 * than riding along with a feature.
 */
export function isPathInside(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
