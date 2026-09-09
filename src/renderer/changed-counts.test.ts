import { describe, expect, it } from "vitest";

import type {
  VaultTreeDirectory,
  VaultTreeFile,
} from "../shared/contracts/vault";
import { changedCounts } from "./changed-counts";

const file = (relativePath: string): VaultTreeFile => ({
  kind: "markdown",
  mtimeMs: 0,
  name: relativePath.split("/").at(-1) ?? relativePath,
  relativePath,
  size: 0,
  title: relativePath,
});

const directory = (
  relativePath: string,
  children: VaultTreeDirectory["children"],
): VaultTreeDirectory => ({
  children,
  kind: "directory",
  name: relativePath.split("/").at(-1) ?? "Vault",
  relativePath,
});

const tree = directory("", [
  directory("projects", [
    directory("projects/webmcp", [
      file("projects/webmcp/plan.md"),
      file("projects/webmcp/notes.md"),
    ]),
    file("projects/roadmap.md"),
  ]),
  directory("archive", []),
  file("readme.md"),
]);

describe("changedCounts", () => {
  it("accumulates changed descendants through every ancestor directory", () => {
    const counts = changedCounts(
      tree,
      new Set(["projects/webmcp/plan.md", "readme.md"]),
    );

    expect(counts.get("projects/webmcp")).toBe(1);
    expect(counts.get("projects")).toBe(1);
    expect(counts.get("")).toBe(2);
  });

  it("reports zero for directories with no changed files, including empty ones", () => {
    const counts = changedCounts(tree, new Set(["readme.md"]));

    expect(counts.get("archive")).toBe(0);
    expect(counts.get("projects")).toBe(0);
    expect(counts.get("")).toBe(1);
  });

  it("ignores changed paths that are no longer present in the tree", () => {
    const counts = changedCounts(
      tree,
      new Set(["projects/webmcp/plan.md", "deleted/elsewhere.md"]),
    );

    expect(counts.get("")).toBe(1);
    expect(counts.has("deleted")).toBe(false);
  });

  it("counts nothing when no files have changed", () => {
    const counts = changedCounts(tree, new Set());

    expect(counts.get("")).toBe(0);
    expect(counts.get("projects/webmcp")).toBe(0);
  });
});
