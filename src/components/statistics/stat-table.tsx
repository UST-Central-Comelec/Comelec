import type { CSSProperties } from "react";
import { barLengths, columnKinds, totals, type Grid } from "@/lib/statistics/table";

type Props = {
  table: Grid;
  /** The column drawn with bars, if it holds figures. */
  barColumn: number | null;
  showTotal: boolean;
  /** What the table is, for screen readers. */
  label: string;
  /** Whose stylesheet dresses it: "st" on the website (statistics.css), "portal-stat" in the portal's preview (portal.css). */
  prefix: "st" | "portal-stat";
};

/**
 * A table of figures: the first column names each row, columns of figures sit right-aligned in
 * tabular numerals, one of them can carry a bar beside each figure, and a row of totals can close it. No hooks,
 * so the website renders it on the server and the portal's form previews with it as you type.
 */
export function StatTable({ table, barColumn, showTotal, label, prefix }: Props) {
  const kinds = columnKinds(table);
  const bar = barColumn !== null && kinds[barColumn] && kinds[barColumn] !== "text" ? barColumn : null;
  const lengths = bar === null ? [] : barLengths(table, bar, kinds[bar]);
  // The figures beside the bars share a width, so every bar starts on the same line.
  const widest = bar === null ? 0 : Math.max(...table.rows.map((row) => row[bar].length));
  const sums = showTotal ? totals(table, kinds) : null;
  const numeric = (index: number) => (kinds[index] === "text" ? undefined : "is-num");

  return (
    <table className={`${prefix}-table`} aria-label={label}>
      <thead>
        <tr>{table.columns.map((heading, index) => <th key={index} scope="col" className={numeric(index)}>{heading}</th>)}</tr>
      </thead>
      <tbody>
        {table.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, index) => {
              if (index === 0) return <th key={index} scope="row">{cell}</th>;
              if (index !== bar) return <td key={index} className={numeric(index)}>{cell}</td>;
              return (
                <td key={index} className="is-num">
                  <span className={`${prefix}-cell`}>
                    <span className={`${prefix}-bar`} aria-hidden="true"><i style={{ width: `${lengths[rowIndex] ?? 0}%` }} /></span>
                    <span className={`${prefix}-value`} style={{ "--chars": widest } as CSSProperties}>{cell}</span>
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      {sums?.some((sum) => sum !== null) && (
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            {sums.slice(1).map((sum, index) => <td key={index} className="is-num">{sum}</td>)}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
