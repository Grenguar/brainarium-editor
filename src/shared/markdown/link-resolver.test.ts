import { describe, expect, it } from "vitest";

import type { VaultDocument } from "../../shared/contracts/vault";
import { resolveMarkdownLink, resolveWikiLink } from "./link-resolver";

const documents: VaultDocument[] = [
  {
    kind: "markdown",
    mtimeMs: 0,
    name: "Start.md",
    relativePath: "notes/Start.md",
    size: 0,
    title: "Start",
  },
  {
    kind: "markdown",
    mtimeMs: 0,
    name: "Topic.md",
    relativePath: "notes/Topic.md",
    size: 0,
    title: "Topic",
  },
  {
    kind: "markdown",
    mtimeMs: 0,
    name: "Topic.md",
    relativePath: "archive/Topic.md",
    size: 0,
    title: "Topic",
  },
  {
    kind: "markdown",
    mtimeMs: 0,
    name: "unique.md",
    relativePath: "unique.md",
    size: 0,
    title: "One of a kind",
  },
];

describe("Markdown link resolution", () => {
  it("uses exact source-relative paths before a vault-relative path", () => {
    expect(
      resolveWikiLink(documents, "notes/Start.md", "Topic#section"),
    ).toEqual({
      fragment: "section",
      relativePath: "notes/Topic.md",
      status: "resolved",
    });
    expect(
      resolveWikiLink(documents, "notes/Start.md", "archive/Topic"),
    ).toMatchObject({ relativePath: "archive/Topic.md", status: "resolved" });
  });

  it("only uses a title or basename when exactly one note matches", () => {
    expect(resolveWikiLink(documents, "notes/Start.md", "Topic")).toMatchObject(
      {
        relativePath: "notes/Topic.md",
        status: "resolved",
      },
    );
    expect(
      resolveWikiLink(documents, "notes/Start.md", "unique"),
    ).toMatchObject({
      relativePath: "unique.md",
      status: "resolved",
    });
    expect(
      resolveWikiLink(documents, "notes/Start.md", "One of a kind"),
    ).toMatchObject({
      relativePath: "unique.md",
      status: "resolved",
    });
  });

  it("does not guess ordinary Markdown links by title", () => {
    expect(
      resolveMarkdownLink(documents, "notes/Start.md", "One of a kind"),
    ).toEqual({ status: "missing" });
    expect(
      resolveMarkdownLink(documents, "notes/Start.md", "../unique.md"),
    ).toEqual({
      relativePath: "unique.md",
      status: "resolved",
    });
  });

  it("rejects malformed and out-of-vault paths", () => {
    expect(resolveWikiLink(documents, "notes/Start.md", "%zz")).toEqual({
      status: "missing",
    });
    expect(
      resolveWikiLink(documents, "notes/Start.md", "../../secret"),
    ).toEqual({
      status: "missing",
    });
  });
});
