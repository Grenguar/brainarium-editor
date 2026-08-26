import { describe, expect, it } from "vitest";

import {
  filterMarkdownInsertCommands,
  insertMarkdownAtRange,
  insertionSelection,
  markdownInsertCommands,
  slashCommandQueryAt,
} from "./markdown-insert-menu";

describe("Markdown insert menu", () => {
  it("offers only portable Markdown and GFM snippets", () => {
    expect(markdownInsertCommands.map(({ id }) => id)).toEqual([
      "paragraph",
      "heading-1",
      "heading-2",
      "heading-3",
      "heading-4",
      "heading-5",
      "heading-6",
      "bullet-list",
      "numbered-list",
      "task-list",
      "quote",
      "code-block",
      "horizontal-rule",
      "link",
      "image",
      "table",
    ]);
    expect(markdownInsertCommands.find(({ id }) => id === "image")?.text).toBe(
      "![Alt text](path/to/image.png)",
    );
  });

  it("filters by command labels and aliases", () => {
    expect(filterMarkdownInsertCommands("check").map(({ id }) => id)).toEqual([
      "task-list",
    ]);
    expect(
      filterMarkdownInsertCommands("heading 2").map(({ id }) => id),
    ).toEqual(["heading-2"]);
  });

  it("recognizes a slash command only at the cursor on the current line", () => {
    expect(slashCommandQueryAt("  /table", 100, 108)).toEqual({
      from: 102,
      query: "table",
    });
    expect(slashCommandQueryAt("before /table after", 0, 14)).toBeNull();
    expect(slashCommandQueryAt("path/to/file", 0, 12)).toBeNull();
  });

  it("places the cursor at a useful editable position after insertion", () => {
    const codeBlock = markdownInsertCommands.find(
      ({ id }) => id === "code-block",
    );
    expect(codeBlock).toBeDefined();
    expect(insertionSelection(10, codeBlock!)).toEqual({
      anchor: 14,
      head: 14,
    });
  });

  it("replaces only the slash command range with source Markdown", () => {
    const table = markdownInsertCommands.find(({ id }) => id === "table");
    expect(table).toBeDefined();
    expect(
      insertMarkdownAtRange("before /table after", { from: 7, to: 13 }, table!),
    ).toBe(
      "before | Column 1 | Column 2 |\n| --- | --- |\n| Value | Value | after",
    );
  });
});
