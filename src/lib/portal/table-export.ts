import { tableXlsx } from "./directory-export";

export async function createTableExport(columns: string[], rows: string[][], format: string) {
  if (format === "xlsx") return { body: new Uint8Array(tableXlsx(columns, rows, "Registrants")), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  if (format === "csv") {
    const cell = (value: string) => `"${(/^[\s]*[=+@\-]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
    return { body: "\ufeff" + [columns, ...rows].map(row => row.map(cell).join(",")).join("\r\n"), type: "text/csv; charset=utf-8" };
  }
  if (format === "json") return { body: JSON.stringify(rows.map(row => Object.fromEntries(columns.map((column, index) => [column, row[index]]))), null, 2), type: "application/json; charset=utf-8" };
  const [{ PDFDocument, rgb }, { default: fontkit }, { readFile }, { join }] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit"), import("node:fs/promises"), import("node:path")]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const font = await document.embedFont(await readFile(join(process.cwd(), "public/fonts/Geist-Regular.ttf")), { subset: true });
  document.setTitle("Event registrants");
  const width = 1190, height = 842, margin = 32;
  const cellWidth = (width - margin * 2) / columns.length;
  let page = document.addPage([width, height]);
  let y = height - margin;
  const wrap = (text: string) => {
    const lines: string[] = [];
    let line = "";
    for (const char of text.replace(/[\u0000-\u001f]/g, " ")) {
      if (line && font.widthOfTextAtSize(line + char, 8) > cellWidth - 12) { lines.push(line); line = ""; }
      line += char;
    }
    lines.push(line);
    return lines;
  };
  const draw = (cells: string[][], offset: number, count: number, header = false) => {
    const rowHeight = count * 11 + 12;
    cells.forEach((lines, index) => {
      page.drawRectangle({ x: margin + index * cellWidth, y: y - rowHeight, width: cellWidth, height: rowHeight, borderWidth: 0.4, borderColor: rgb(.7, .7, .7), ...(header ? { color: rgb(.94, .94, .94) } : {}) });
      lines.slice(offset, offset + count).forEach((line, lineIndex) => page.drawText(line, { x: margin + index * cellWidth + 6, y: y - 14 - lineIndex * 11, font, size: 8 }));
    });
    y -= rowHeight;
  };
  const heading = () => {
    page.drawText("Event registrants", { x: margin, y: y - 16, font, size: 16 });
    y -= 34;
    const cells = columns.map(wrap);
    draw(cells, 0, Math.max(...cells.map(lines => lines.length)), true);
  };
  heading();
  for (const row of rows) {
    const cells = row.map(wrap);
    const lineCount = Math.max(...cells.map(lines => lines.length));
    if (y - (lineCount * 11 + 12) < margin && lineCount * 11 + 12 < height - 140) { page = document.addPage([width, height]); y = height - margin; heading(); }
    let offset = 0;
    while (offset < lineCount) {
      const available = Math.floor((y - margin - 12) / 11);
      if (available < 1) { page = document.addPage([width, height]); y = height - margin; heading(); continue; }
      const count = Math.min(lineCount - offset, available);
      draw(cells, offset, count);
      offset += count;
    }
  }
  return { body: await document.save(), type: "application/pdf" };
}
