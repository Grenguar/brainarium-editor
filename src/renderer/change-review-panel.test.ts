import { describe, expect, it } from "vitest";

import { blockChanges, markdownBlocks } from "./change-review-panel";

describe("change review blocks", () => {
  it("keeps a complete changed paragraph visible for a one-word edit", () => {
    expect(
      blockChanges(
        "The plan has a calm review step.\n\nUnchanged.",
        "The plan has an explicit review step.\n\nUnchanged.",
      ),
    ).toEqual([
      expect.objectContaining({
        after: {
          kind: "paragraph",
          text: "The plan has an explicit review step.",
        },
        before: { kind: "paragraph", text: "The plan has a calm review step." },
        kind: "replaced",
      }),
    ]);
  });

  it("keeps a complete GFM table together as one block", () => {
    expect(
      markdownBlocks("| Plan | Owner |\n| --- | --- |\n| Review | Igor |"),
    ).toEqual([
      {
        kind: "table",
        text: "| Plan | Owner |\n| --- | --- |\n| Review | Igor |",
      },
    ]);
  });
});
