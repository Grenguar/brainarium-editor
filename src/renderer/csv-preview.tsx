import type { ReactNode } from "react";

import {
  type CsvRow,
  nonEmptyCells,
  parseCsv,
  toCsvTable,
} from "../shared/csv";

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
