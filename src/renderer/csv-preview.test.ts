import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv-preview";

describe("parseCsv", () => {
  it("preserves commas, escaped quotes, and newlines in quoted values", () => {
    expect(
      parseCsv(
        'Name,Note\r\nAda,"A comma, an ""escaped quote"", and\na newline"',
      ),
    ).toEqual([
      ["Name", "Note"],
      ["Ada", 'A comma, an "escaped quote", and\na newline'],
    ]);
  });

  it("preserves trailing empty cells and removes a UTF-8 BOM", () => {
    expect(parseCsv("\uFEFFName,Age,\nAda,42,")).toEqual([
      ["Name", "Age", ""],
      ["Ada", "42", ""],
    ]);
  });
});
