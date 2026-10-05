/** Logical table coordinates account for cells spanning more than one row or column. */
export type TableCellPosition = { cell: HTMLTableCellElement; row: number; column: number; rowSpan: number; colSpan: number };
export type TableBounds = { top: number; left: number; bottom: number; right: number };

export function documentTableGrid(table: HTMLTableElement) {
  const positions: TableCellPosition[] = [];
  const grid: HTMLTableCellElement[][] = [];
  [...table.rows].forEach((row, rowIndex) => {
    grid[rowIndex] ??= [];
    let column = 0;
    for (const cell of row.cells) {
      while (grid[rowIndex][column]) column++;
      const section = row.parentElement as HTMLTableSectionElement;
      const rowSpan = Math.min(cell.rowSpan || section.rows.length, section.rows.length - row.sectionRowIndex);
      const colSpan = cell.colSpan;
      positions.push({ cell, row: rowIndex, column, rowSpan, colSpan });
      for (let r = rowIndex; r < rowIndex + rowSpan; r++) {
        grid[r] ??= [];
        for (let c = column; c < column + colSpan; c++) grid[r][c] = cell;
      }
      column += colSpan;
    }
  });
  return { positions, grid, rows: table.rows.length, columns: Math.max(0, ...grid.map(row => row.length)) };
}

/** Expand a rectangle to include every existing merged cell it touches, without splitting one. */
export function documentTableBounds(positions: TableCellPosition[], cells: HTMLTableCellElement[]): TableBounds | null {
  const selected = positions.filter(position => cells.includes(position.cell));
  if (!selected.length) return null;
  const bounds = { top: Math.min(...selected.map(p => p.row)), left: Math.min(...selected.map(p => p.column)), bottom: Math.max(...selected.map(p => p.row + p.rowSpan)), right: Math.max(...selected.map(p => p.column + p.colSpan)) };
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const p of positions) {
      if (p.row >= bounds.bottom || p.row + p.rowSpan <= bounds.top || p.column >= bounds.right || p.column + p.colSpan <= bounds.left) continue;
      const next = { top: Math.min(bounds.top, p.row), left: Math.min(bounds.left, p.column), bottom: Math.max(bounds.bottom, p.row + p.rowSpan), right: Math.max(bounds.right, p.column + p.colSpan) };
      if (Object.keys(bounds).some(key => bounds[key as keyof TableBounds] !== next[key as keyof TableBounds])) { Object.assign(bounds, next); expanded = true; }
    }
  }
  return bounds;
}

export function documentTableCells(table: HTMLTableElement, endpoints: HTMLTableCellElement[]) {
  const { positions } = documentTableGrid(table);
  const bounds = documentTableBounds(positions, endpoints);
  return bounds ? positions.filter(p => p.row >= bounds.top && p.row < bounds.bottom && p.column >= bounds.left && p.column < bounds.right).map(p => p.cell) : [];
}

type CellSpec = TableCellPosition & { html?: string };

function buildTable(source: HTMLTableElement | null, rows: number, columns: number, header: boolean, positions: CellSpec[]) {
  const table = document.createElement("table");
  if (source?.style.cssText) table.style.cssText = source.style.cssText;
  const tbody = table.createTBody();
  const occupied: boolean[][] = [];
  const anchors = new Map(positions.map(p => [`${p.row}:${p.column}`, p]));
  for (let r = 0; r < rows; r++) {
    const row = r === 0 && header ? table.createTHead().insertRow() : tbody.insertRow();
    occupied[r] ??= [];
    for (let c = 0; c < columns; c++) {
      if (occupied[r][c]) continue;
      const old = anchors.get(`${r}:${c}`);
      const cell = document.createElement(r === 0 && header ? "th" : "td");
      cell.innerHTML = old?.html ?? old?.cell.innerHTML ?? "<br>";
      if (old?.cell.style.cssText) cell.style.cssText = old.cell.style.cssText;
      cell.rowSpan = Math.min(old?.rowSpan ?? 1, r === 0 && header ? 1 : rows - r);
      cell.colSpan = Math.min(old?.colSpan ?? 1, columns - c);
      for (let rr = r; rr < r + cell.rowSpan; rr++) {
        occupied[rr] ??= [];
        for (let cc = c; cc < c + cell.colSpan; cc++) occupied[rr][cc] = true;
      }
      row.append(cell);
    }
  }
  return table;
}

export function resizeDocumentTable(table: HTMLTableElement | null, rows: number, columns: number, header: boolean) {
  return buildTable(table, rows, columns, header, table ? documentTableGrid(table).positions : []);
}

export function mergeDocumentTableCells(table: HTMLTableElement, selected: HTMLTableCellElement[]) {
  const { positions, grid, rows, columns } = documentTableGrid(table);
  const bounds = documentTableBounds(positions, selected);
  if (!bounds) throw new Error("Select at least two cells to merge.");
  const cells = documentTableCells(table, selected);
  if (cells.length < 2) throw new Error("Select at least two cells to merge.");
  const section = cells[0].parentElement?.parentElement;
  if (cells.some(cell => cell.parentElement?.parentElement !== section)) throw new Error("Merge header cells or body cells separately.");
  for (let r = bounds.top; r < bounds.bottom; r++) for (let c = bounds.left; c < bounds.right; c++) {
    if (!grid[r]?.[c]) throw new Error("Select a complete rectangle of table cells.");
  }
  const target = positions.find(p => p.row === bounds.top && p.column === bounds.left)!;
  const html = cells.filter(cell => cell.textContent?.trim()).map(cell => cell.innerHTML).join("<br>") || "<br>";
  const specs = positions.filter(p => !cells.includes(p.cell) || p === target).map(p => p === target ? { ...p, rowSpan: bounds.bottom - bounds.top, colSpan: bounds.right - bounds.left, html } : p);
  return { table: buildTable(table, rows, columns, Boolean(table.rows[0]?.querySelector("th")), specs), row: bounds.top, column: bounds.left };
}

export function splitDocumentTableCell(table: HTMLTableElement, cell: HTMLTableCellElement) {
  const { positions, rows, columns } = documentTableGrid(table);
  const target = positions.find(p => p.cell === cell);
  if (!target || (target.rowSpan === 1 && target.colSpan === 1)) throw new Error("Select a merged cell to split.");
  const specs = positions.map(p => p === target ? { ...p, rowSpan: 1, colSpan: 1 } : p);
  return { table: buildTable(table, rows, columns, Boolean(table.rows[0]?.querySelector("th")), specs), row: target.row, column: target.column };
}
