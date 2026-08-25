import { describe, expect, it } from "vitest";

import { detectDelimiter, parseCsv } from "./csv-preview";

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

  it("detects semicolon-delimited exports while preserving empty fields", () => {
    const source = "Order;Name;Symbol\n;;AAPL\n42;Marvell;MRVL";

    expect(detectDelimiter(source)).toBe(";");
    expect(parseCsv(source)).toEqual([
      ["Order", "Name", "Symbol"],
      ["", "", "AAPL"],
      ["42", "Marvell", "MRVL"],
    ]);
  });
});
