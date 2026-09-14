import { describe, expect, it } from "vitest";

import { detectDelimiter, parseCsv, toCsvTable } from "./csv";

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

  it("parses a bank export with a declared semicolon dialect", () => {
    const source = [
      "sep=;",
      "Booking date;Value date;Description;Reference;Amount;Currency",
      '"2026-08-24";"2026-08-24";"Card payment";"Cafe; Salou";"-12,34";"EUR"',
      '"2026-08-25";"";"Transfer";"Invoice ""August""";"1.250,00";"EUR"',
    ].join("\r\n");

    expect(detectDelimiter(source)).toBe(";");
    expect(parseCsv(source)).toEqual([
      [
        "Booking date",
        "Value date",
        "Description",
        "Reference",
        "Amount",
        "Currency",
      ],
      [
        "2026-08-24",
        "2026-08-24",
        "Card payment",
        "Cafe; Salou",
        "-12,34",
        "EUR",
      ],
      ["2026-08-25", "", "Transfer", 'Invoice "August"', "1.250,00", "EUR"],
    ]);
  });

  it("chooses semicolons over unquoted decimal commas", () => {
    const source = [
      "Date;Description;Amount;Balance",
      "2026-08-24;Card payment;-12,34;987,66",
      "2026-08-25;Transfer;1.250,00;2.237,66",
    ].join("\n");

    expect(detectDelimiter(source)).toBe(";");
    expect(parseCsv(source)).toEqual([
      ["Date", "Description", "Amount", "Balance"],
      ["2026-08-24", "Card payment", "-12,34", "987,66"],
      ["2026-08-25", "Transfer", "1.250,00", "2.237,66"],
    ]);
  });

  it("uses the bank column row after delimiter-only and report preamble rows", () => {
    const source = [
      ";;;;;",
      "Account statement for August 2026",
      "Prepared 2026-08-25;;;;;",
      ";;;;;",
      ";F;Value date;Booking date;Description;Amount",
      ";1;2026-08-24;2026-08-24;Card payment;-12,34",
      ";2;2026-08-25;2026-08-25;Transfer;1.250,00",
    ].join("\n");

    expect(detectDelimiter(source)).toBe(";");
    expect(toCsvTable(parseCsv(source))).toEqual({
      metadata: [
        ["Account statement for August 2026"],
        ["Prepared 2026-08-25", "", "", "", "", ""],
      ],
      header: ["", "F", "Value date", "Booking date", "Description", "Amount"],
      rows: [
        ["", "1", "2026-08-24", "2026-08-24", "Card payment", "-12,34"],
        ["", "2", "2026-08-25", "2026-08-25", "Transfer", "1.250,00"],
      ],
    });
  });
});
