// The Statistics page's tables: figures the commission publishes (voters, turnout, candidates and so
// on), each entered in the portal by pasting a table from a spreadsheet. Kept free of server-only
// imports: the portal's form reads and previews a pasted table the same way the server saves it.

export type StatisticTable = {
  id: string;
  title: string;
  /** What the table is grouped under on the page, e.g. "2026 Central Student Council Elections". */
  period: string;
  /** The day the figures are as of (YYYY-MM-DD). */
  asOf: string;
  /** One or two sentences on what the table shows. May be empty. */
  summary: string;
  /** The column headings. The first column names each row. */
  columns: string[];
  /** The cells, row by row, each row as wide as `columns`. */
  rows: string[][];
  /** The column drawn with bars (never the first), or null for none. */
  barColumn: number | null;
  /** Whether a row of totals closes the table. */
  showTotal: boolean;
  /** Where the figures come from, or how to read them. May be empty. */
  note: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

/** A table's headings and cells, without the rest. */
export type Grid = Pick<StatisticTable, "columns" | "rows">;

export const MAX_COLUMNS = 10;
export const MAX_ROWS = 300;
export const MAX_CELL = 160;

/** Delimited text as rows of cells: tabs (as a spreadsheet copies) or commas, with "quoted cells". */
function split(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char !== '"') cell += char;
      // A doubled quote inside a quoted cell is one quote; a single one closes the cell.
      else if (text[index + 1] === '"') { cell += '"'; index++; }
      else quoted = false;
    } else if (char === '"' && cell === "") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/**
 * A pasted table as headings and rows: the first line is the headings. Text with tabs in it is read
 * as copied from a spreadsheet; otherwise commas separate the cells. Blank lines and columns that are
 * empty all the way down are dropped. Returns what's wrong, in words, when it can't be a table.
 */
export function parseTable(text: string): Grid | { error: string } {
  const source = text.replace(/\r\n?/g, "\n");
  const lines = split(source, source.includes("\t") ? "\t" : ",")
    .map((row) => row.map((cell) => cell.replace(/\s+/g, " ").trim()))
    .filter((row) => row.some(Boolean));
  if (lines.length < 2) return { error: "Add a row of headings, then at least one row of figures." };

  const width = Math.max(...lines.map((row) => row.reduce((last, cell, index) => (cell ? index + 1 : last), 0)));
  if (width < 2) return { error: "A table needs at least two columns: what each row is, and a figure for it." };
  if (width > MAX_COLUMNS) return { error: `That’s ${width} columns. Keep a table to ${MAX_COLUMNS} or fewer.` };

  const [columns, ...rows] = lines.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  if (rows.length > MAX_ROWS) return { error: `That’s ${rows.length} rows. Keep a table to ${MAX_ROWS} or fewer.` };
  if (columns.some((heading) => !heading)) return { error: "Every column needs a heading in the first row." };
  if (lines.some((row) => row.some((cell) => cell.length > MAX_CELL))) return { error: `Keep each cell under ${MAX_CELL} characters.` };
  return { columns, rows };
}

/** A table as tab-separated text, the way it's pasted: what the portal's form shows for editing. */
export function toPasteText({ columns, rows }: Grid) {
  // A cell that opens with a quote would be read back as a quoted cell, so it's written as one.
  const cell = (value: string) => (value.startsWith('"') ? `"${value.replace(/"/g, '""')}"` : value);
  return [columns, ...rows].map((row) => row.map(cell).join("\t")).join("\n");
}

const NUMBER = /^[-−]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$/;

/** A cell left empty on purpose: nothing, a dash, or "n/a". */
const isBlank = (cell: string) => cell === "" || /^(-|–|—|n\/a)$/i.test(cell);

/** A cell as a number: "1,204" is 1204 and "56.7%" is 56.7. Null for anything that isn't one. */
export function toNumber(cell: string) {
  const text = cell.replace(/\s/g, "");
  return NUMBER.test(text) ? Number(text.replace(/,/g, "").replace("−", "-").replace("%", "")) : null;
}

/**
 * A table as a CSV file's text, for the Statistics page's download. It starts with a byte-order mark
 * so Excel reads it as UTF-8, and words that a spreadsheet would run as a formula (a cell opening
 * with =, +, - or @ that isn't a number) are written with a leading apostrophe, so they stay words.
 */
export function toCsv({ columns, rows }: Grid) {
  const cell = (value: string) => {
    const safe = /^[=+\-@]/.test(value) && toNumber(value) === null ? `'${value}` : value;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return `﻿${[columns, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`;
}

/** What a column holds: words, counts, or percentages. Decides its alignment, totals and bars. */
export type ColumnKind = "text" | "number" | "percent";

/** Each column's kind. The first names the rows, so it's always text; blank cells don't count against a column. */
export function columnKinds({ columns, rows }: Grid): ColumnKind[] {
  return columns.map((_, index) => {
    if (index === 0) return "text";
    const cells = rows.map((row) => row[index]).filter((cell) => !isBlank(cell));
    if (!cells.length || cells.some((cell) => toNumber(cell) === null)) return "text";
    return cells.every((cell) => cell.endsWith("%")) ? "percent" : "number";
  });
}

/** The columns that can be drawn with bars: every column of counts or percentages. */
export const barColumns = (kinds: ColumnKind[]) => kinds.flatMap((kind, index) => (kind === "text" ? [] : [index]));

const decimalsOf = (cell: string) => /\.(\d+)/.exec(cell)?.[1].length ?? 0;

/**
 * The row of totals: each column of counts added up, written with the decimals its cells use.
 * Percentages don't add up to anything meaningful, so they (and words) get null.
 */
export function totals({ rows }: Grid, kinds: ColumnKind[]) {
  return kinds.map((kind, index) => {
    if (kind !== "number") return null;
    const cells = rows.map((row) => row[index]).filter((cell) => !isBlank(cell));
    const decimals = Math.max(0, ...cells.map(decimalsOf));
    const sum = cells.reduce((total, cell) => total + (toNumber(cell) ?? 0), 0);
    return sum.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  });
}

/**
 * How far along its track each row's bar reaches (0 to 100), for the column drawn with bars.
 * Percentages are drawn out of 100, so 56% fills 56% of the track; counts are drawn against the
 * largest in the column. Null for a row with no figure there.
 */
export function barLengths({ rows }: Grid, column: number, kind: ColumnKind) {
  const values = rows.map((row) => (isBlank(row[column]) ? null : toNumber(row[column])));
  const largest = Math.max(0, ...values.map((value) => value ?? 0));
  const full = kind === "percent" && largest <= 100 ? 100 : largest;
  return values.map((value) => (value === null || full === 0 ? null : Math.round((Math.max(0, value) / full) * 1000) / 10));
}

// Accents are dropped rather than turned into dashes: "Señor" is "senor".
const slug = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export type PeriodGroup = { period: string; anchor: string; tables: StatisticTable[] };

/**
 * Tables grouped by what they're filed under, the group with the most recent figures first. Inside a
 * group, the most recent come first, then by title.
 */
export function byPeriod(tables: StatisticTable[]): PeriodGroup[] {
  const groups = new Map<string, StatisticTable[]>();
  for (const table of tables) groups.set(table.period, [...(groups.get(table.period) ?? []), table]);
  const latest = (list: StatisticTable[]) => list.reduce((date, table) => (table.asOf > date ? table.asOf : date), "");
  // Two groups whose names differ only in punctuation would land on the same anchor; the later one is numbered.
  const taken = new Set<string>();
  const anchorFor = (period: string) => {
    const base = `period-${slug(period) || "figures"}`;
    let anchor = base;
    for (let n = 2; taken.has(anchor); n++) anchor = `${base}-${n}`;
    taken.add(anchor);
    return anchor;
  };
  return [...groups]
    .map(([period, list]) => ({ period, tables: [...list].sort((a, b) => b.asOf.localeCompare(a.asOf) || a.title.localeCompare(b.title)) }))
    .sort((a, b) => latest(b.tables).localeCompare(latest(a.tables)) || a.period.localeCompare(b.period))
    .map((group) => ({ ...group, anchor: anchorFor(group.period) }));
}

/** "21 rows × 4 columns" */
export const sizeLabel = ({ columns, rows }: Grid) => `${rows.length} ${rows.length === 1 ? "row" : "rows"} × ${columns.length} columns`;
