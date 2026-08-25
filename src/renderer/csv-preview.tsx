import type { ReactNode } from "react";

/** A parsed CSV record. Empty cells and trailing empty cells are preserved. */
export type CsvRow = string[];

export type CsvTable = {
  metadata: CsvRow[];
  header: CsvRow;
  rows: CsvRow[];
};

const candidates = [",", ";", "\t"] as const;

const csvDialectDirective = (source: string): string | undefined => {
  const directive = /^\uFEFF?[ \t]*sep=([,;\t])(?:\r\n|\n|\r)/i.exec(source);
  return directive?.[1];
};

const withoutDialectDirective = (source: string): string =>
  source.replace(/^\uFEFF?[ \t]*sep=[,;\t](?:\r\n|\n|\r)/i, "");

/**
 * Parses a known delimited-text dialect. It deliberately preserves empty and
 * uneven cells: exports often use them to mean unavailable bank details.
 */
const parseDelimited = (content: string, delimiter: string): CsvRow[] => {
  const rows: CsvRow[] = [];
  const row: string[] = [];
  let field = "";
  let isQuoted = false;

  const finishField = (): void => {
    row.push(field);
    field = "";
  };
  const finishRow = (): void => {
    finishField();
    rows.push([...row]);
    row.length = 0;
  };

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (isQuoted) {
      if (character === '"') {
        if (content[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          isQuoted = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      isQuoted = true;
    } else if (character === delimiter) {
      finishField();
    } else if (character === "\n") {
      finishRow();
    } else if (character === "\r") {
      if (content[index + 1] === "\n") index += 1;
      finishRow();
    } else {
      field += character;
    }
  }

  // Do not manufacture a record for the conventional trailing newline.
  if (field.length > 0 || row.length > 0 || isQuoted) finishRow();
  return rows;
};

/**
 * Detects comma, semicolon, or tab exports by parsing complete logical rows.
 * Looking at full records, rather than splitting the header line, means
 * embedded commas, escaped quotes, and multiline descriptions cannot select
 * the wrong delimiter.
 */
export const detectDelimiter = (source: string): string => {
  const declaredDelimiter = csvDialectDirective(source);
  if (declaredDelimiter) return declaredDelimiter;

  const content = source.startsWith("\uFEFF") ? source.slice(1) : source;
  let winner = ",";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const rows = parseDelimited(content, candidate).filter((row) =>
      row.some((cell) => cell.length > 0),
    );
    const widths = new Map<number, number>();
    for (const row of rows)
      widths.set(row.length, (widths.get(row.length) ?? 0) + 1);

    const [modalWidth = 1, modalCount = 0] =
      [...widths.entries()].sort(
        ([widthA, countA], [widthB, countB]) =>
          countB - countA || widthB - widthA,
      )[0] ?? [];
    // Favor a consistently structured, wider table. The tie-break order of
    // `candidates` intentionally keeps a conventional comma file as comma.
    const score = modalWidth * 10_000 + modalCount * 100 + rows.length;
    if (score > bestScore) {
      bestScore = score;
      winner = candidate;
    }
  }

  return winner;
};

/**
 * Parses comma-separated UTF-8 text using the RFC 4180 quoting conventions.
 * Quoted values may contain commas, escaped quotes, and line endings.
 */
export const parseCsv = (
  source: string,
  delimiter = detectDelimiter(source),
): CsvRow[] =>
  parseDelimited(
    withoutDialectDirective(source).replace(/^\uFEFF/, ""),
    delimiter,
  );

const cellValue = (row: CsvRow, column: number): string => row[column] ?? "";

const nonEmptyCells = (row: CsvRow): string[] =>
  row.filter((cell) => cell.trim().length > 0);

/**
 * Separates a report preamble from the table proper. Some bank exports begin
 * with blank delimiter rows and a report title before their actual column row.
 */
export const toCsvTable = (rows: CsvRow[]): CsvTable => {
  const headerIndex = rows.findIndex((row) => nonEmptyCells(row).length >= 2);

  if (headerIndex === -1) {
    const firstContentIndex = rows.findIndex(
      (row) => nonEmptyCells(row).length > 0,
    );
    if (firstContentIndex === -1) return { metadata: [], header: [], rows: [] };
    return {
      metadata: rows
        .slice(0, firstContentIndex)
        .filter((row) => row.length > 0),
      header: rows[firstContentIndex],
      rows: rows
        .slice(firstContentIndex + 1)
        .filter((row) => nonEmptyCells(row).length > 0),
    };
  }

  const header = rows[headerIndex];
  return {
    metadata: rows
      .slice(0, headerIndex)
      .filter((row) => nonEmptyCells(row).length > 0),
    header,
    // Keep malformed (but non-empty) rows visible, while excluding report
    // prose after the preamble. A valid delimited record retains its columns.
    rows: rows
      .slice(headerIndex + 1)
      .filter(
        (row) => nonEmptyCells(row).length > 0 && row.length === header.length,
      ),
  };
};

const DataCell = ({ value }: { value: string }): React.JSX.Element =>
  value ? (
    <>{value}</>
  ) : (
    <span className="csv-empty-cell" aria-label="Empty value">
      —
    </span>
  );

/**
 * A safe, read-only tabular rendering of CSV source. Styling belongs to the
 * workspace stylesheet; the wrapper intentionally permits horizontal scrolling.
 */
export const CsvPreview = ({
  source,
}: {
  source: string;
}): React.JSX.Element => {
  const { metadata, header, rows } = toCsvTable(parseCsv(source));
  const columnCount = Math.max(
    header.length,
    ...rows.map((row) => row.length),
    0,
  );
  const columns = Array.from({ length: columnCount }, (_, index) => index);

  if (columnCount === 0) {
    return <p className="csv-preview-empty">This CSV file is empty.</p>;
  }

  const headers: ReactNode[] = columns.map((column) => (
    <th key={column} scope="col">
      {cellValue(header, column) || `Column ${column + 1}`}
    </th>
  ));

  return (
    <>
      {metadata.length > 0 && (
        <aside aria-label="CSV report details" className="csv-preview-metadata">
          {metadata.map((row, index) => (
            <p key={index}>{nonEmptyCells(row).join(" · ")}</p>
          ))}
        </aside>
      )}
      <div
        aria-label="CSV table"
        className="csv-preview-scroll"
        role="region"
        tabIndex={0}
      >
        <table className="csv-preview-table">
          <thead>
            <tr>{headers}</tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((column) => (
                  <td key={column}>
                    <DataCell value={cellValue(row, column)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
