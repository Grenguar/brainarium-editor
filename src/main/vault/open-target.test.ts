import { describe, expect, it } from "vitest";

import { relativePathIn, vaultForFile } from "./open-target";

describe("vaultForFile", () => {
  it("finds the vault that contains the file", () => {
    expect(
      vaultForFile(
        ["/vaults/work", "/vaults/personal"],
        "/vaults/work/plan.md",
      ),
    ).toBe("/vaults/work");
  });

  it("prefers the deepest containing vault when they nest", () => {
    expect(
      vaultForFile(
        ["/vaults", "/vaults/work", "/vaults/work/archive"],
        "/vaults/work/archive/old.md",
      ),
    ).toBe("/vaults/work/archive");
  });

  it("returns nothing when no known vault contains the file", () => {
    expect(
      vaultForFile(["/vaults/work"], "/Users/me/Downloads/loose.md"),
    ).toBeUndefined();
  });

  it("does not match a sibling directory that shares a prefix", () => {
    expect(
      vaultForFile(["/vaults/work"], "/vaults/work-archive/plan.md"),
    ).toBeUndefined();
  });

  it("ignores a root that is the file itself", () => {
    expect(
      vaultForFile(["/vaults/plan.md"], "/vaults/plan.md"),
    ).toBeUndefined();
  });

  it("returns nothing when there are no known vaults", () => {
    expect(vaultForFile([], "/vaults/work/plan.md")).toBeUndefined();
  });
});

describe("relativePathIn", () => {
  it("produces the forward-slash form the readers expect", () => {
    expect(relativePathIn("/vaults/work", "/vaults/work/notes/plan.md")).toBe(
      "notes/plan.md",
    );
  });

  it("handles a file directly in the vault root", () => {
    expect(relativePathIn("/vaults/work", "/vaults/work/plan.md")).toBe(
      "plan.md",
    );
  });
});
