import type { ReactNode } from "react";

/** A parsed CSV record. Empty cells and trailing empty cells are preserved. */
export type CsvRow = string[];

const candidates = [",", ";", "\t"] as const;

/** Detects a common delimited-text dialect without splitting quoted values. */
export const detectDelimiter = (source: string): string => {
  const line = source.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/, 1)[0] ?? "";
  let winner = ",";
  let highest = -1;
  for (const candidate of candidates) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === '"') quoted = !quoted;
      else if (!quoted && line[index] === candidate) count += 1;
    }
    if (count > highest) {
      highest = count;
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
): CsvRow[] => {
  const rows: CsvRow[] = [];
  const row: string[] = [];
  let field = "";
  let isQuoted = false;

  // A BOM is not content in a UTF-8 CSV's first header cell.
  const content = source.startsWith("\uFEFF") ? source.slice(1) : source;

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

const cellValue = (row: CsvRow, column: number): string => row[column] ?? "";

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
  const rows = parseCsv(source);
  const [header = [], ...body] = rows;
  const columnCount = Math.max(
    header.length,
    ...body.map((row) => row.length),
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
          {body.map((row, rowIndex) => (
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
  );
};
