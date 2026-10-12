import { accountPositions, chamberRoles } from "@/lib/data/types";
import { formatAccepted } from "@/lib/onboarding/documents";
import type { DirectoryDatabaseRow } from "@/components/portal/directory-database";

export const directoryExportFormats = ["xlsx", "pdf", "csv", "json"] as const;
export type DirectoryExportFormat = (typeof directoryExportFormats)[number];
export const exportColumns = ["Position", "Name", "Photo", "Unit", "Role", "College or faculty", "Program", "Year level", "UST email", "Facebook", "Student number", "Mobile number", "Chamber role", "E-declarations"];
export function directoryExportValues(person: DirectoryDatabaseRow): string[] {
  return [accountPositions[person.position], person.name, person.photoUrl ?? "", person.unit, person.role, person.college, person.program, person.yearLevel, person.email, person.facebookUrl,
    person.studentNumber ?? "Restricted", person.contactNumber ?? "Restricted", person.chamberRole ? chamberRoles[person.chamberRole] : "",
    person.declarations.map(item => `${item.title} — Accepted ${formatAccepted(item.acceptedAt)} · v${item.version}`).join("\n")];
}

export function directoryCsv(people: DirectoryDatabaseRow[]): string {
  const cell = (value: string) => `"${(/^[\s]*[=+@\-]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
  return "\ufeff" + [exportColumns, ...people.map(directoryExportValues)].map(row => row.map(cell).join(",")).join("\r\n");
}

const xml = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);

/** A small uncompressed ZIP for the five XML parts of an Excel workbook. */
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const entries: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name);
    const data = Buffer.from(content);
    let crc = 0xffffffff;
    for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, data);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6); entry.writeUInt16LE(0x21, 14);
    entry.writeUInt32LE(crc, 16); entry.writeUInt32LE(data.length, 20); entry.writeUInt32LE(data.length, 24); entry.writeUInt16LE(filename.length, 28); entry.writeUInt32LE(offset, 42);
    entries.push(entry, filename);
    offset += local.length + filename.length + data.length;
  }
  const central = Buffer.concat(entries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

export function directoryXlsx(people: DirectoryDatabaseRow[]): Buffer {
  const rows = [exportColumns, ...people.map(directoryExportValues)];
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join("")}</row>`).join("");
  return zip({
    "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml": '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Directory" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="14" width="28" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A1:N${rows.length}"/></worksheet>`,
  });
}

export async function directoryPdf(people: DirectoryDatabaseRow[]): Promise<Uint8Array> {
  const [{ PDFDocument }, { default: fontkit }, { readFile }] = await Promise.all([import("pdf-lib"), import("@pdf-lib/fontkit"), import("node:fs/promises")]);
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const { join } = await import("node:path");
  const font = await document.embedFont(await readFile(join(process.cwd(), "public/fonts/Geist-Regular.ttf")), { subset: true });
  document.setTitle("UST Central Comelec Directory");
  let page = document.addPage([595, 842]);
  let y = 796;
  const newPage = () => { page = document.addPage([595, 842]); y = 796; };
  const line = (text: string, size = 10) => {
    if (y < 46) newPage();
    page.drawText(text, { x: 40, y, size, font });
    y -= size + 5;
  };
  const paragraph = (text: string, size = 10) => {
    for (const part of text.split("\n")) {
      let current = "";
      for (const character of part.replace(/[\u0000-\u001f]/g, " ")) {
        if (current && font.widthOfTextAtSize(current + character, size) > 515) { line(current, size); current = ""; }
        current += character;
      }
      line(current, size);
    }
  };
  paragraph("UST Central Comelec · Directory", 18);
  paragraph(`${people.length} ${people.length === 1 ? "person" : "people"}`);
  for (const person of people) {
    if (y < 150) newPage();
    y -= 14;
    paragraph(person.name, 13);
    directoryExportValues(person).forEach((value, index) => { if (value && index !== 1) paragraph(`${exportColumns[index]}: ${value}`); });
  }
  return document.save();
}

export async function createDirectoryExport(people: DirectoryDatabaseRow[], format: DirectoryExportFormat) {
  if (format === "xlsx") return { body: new Uint8Array(directoryXlsx(people)), type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  if (format === "pdf") return { body: await directoryPdf(people), type: "application/pdf" };
  if (format === "csv") return { body: directoryCsv(people), type: "text/csv; charset=utf-8" };
  return { body: JSON.stringify(people.map(person => Object.fromEntries(exportColumns.map((column, index) => [column, directoryExportValues(person)[index]]))), null, 2), type: "application/json; charset=utf-8" };
}
