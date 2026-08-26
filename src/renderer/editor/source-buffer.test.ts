import { describe, expect, it } from "vitest";

import { SourceBuffer } from "./source-buffer";

describe("SourceBuffer", () => {
  it("keeps CRLF and final-newline bytes intact outside the edited projection range", () => {
    const source = new SourceBuffer("# Title\r\n\r\nOld line\r\n");

    expect(source.projection()).toBe("# Title\n\nOld line\n");
    source.applyProjectionChanges([{ from: 9, insert: "New", to: 12 }]);

    expect(source.text()).toBe("# Title\r\n\r\nNew line\r\n");
  });

  it("uses the document newline convention for a newly inserted editor line", () => {
    const source = new SourceBuffer("alpha\r\nbeta");
    source.applyProjectionChanges([{ from: 5, insert: "\ngamma", to: 5 }]);

    expect(source.text()).toBe("alpha\r\ngamma\r\nbeta");
  });

  it("maps source selections over CRLF pairs to CodeMirror projection offsets", () => {
    const source = new SourceBuffer("a\r\nb\r\nc");

    expect(source.sourceOffsetForProjectionOffset(2)).toBe(3);
    expect(source.projectionOffsetForSourceOffset(3)).toBe(2);
    expect(source.projectionOffsetForSourceOffset(1)).toBe(1);
  });

  it("applies disjoint transactions without rewriting untouched mixed line endings", () => {
    const source = new SourceBuffer("one\r\ntwo\nthree\r\n");
    source.applyProjectionChanges([
      { from: 0, insert: "ONE", to: 3 },
      { from: 8, insert: "THREE", to: 13 },
    ]);

    expect(source.text()).toBe("ONE\r\ntwo\nTHREE\r\n");
  });
});
