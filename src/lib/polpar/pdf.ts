import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { conformeDeclarations, rosterSections } from "./content";
import { pdfForms, validatePdf, type PdfFormId, type PdfInput, type PdfSelection } from "./pdf-data";

export type PdfAssets = { regular: Uint8Array; bold: Uint8Array; ust: Uint8Array; comelec: Uint8Array };
const black = rgb(0, 0, 0);
const white = rgb(1, 1, 1);
const grey = rgb(.35, .35, .35);
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const date = (value: string) => { const [year, month, day] = value.split("-").map(Number); return `${months[month - 1]} ${day}, ${year}`; };
const clean = (value: string) => value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

/** Wrap by measured glyph widths, including long email addresses and unbroken names. */
function linesFor(value: string, width: number, font: PDFFont, size: number): string[] {
  const words = clean(value).split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) { line = candidate; continue; }
    if (line) lines.push(line);
    line = "";
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) { lines.push(line); line = ""; }
      line += character;
    }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

type Resources = { doc: PDFDocument; regular: PDFFont; bold: PDFFont; ust: PDFImage; comelec: PDFImage };

/** PDF layout based on the source Word templates: letterheads, paper sizes, tables and wording. */
class FormWriter {
  page!: PDFPage;
  y = 0;
  readonly pages: PDFPage[] = [];
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly contentWidth: number;
  constructor(readonly resources: Resources, readonly id: PdfFormId, readonly title: string, readonly party: string, readonly showParty = false) {
    const landscape = id === "02" || id === "05";
    this.width = landscape ? 936 : 612;
    this.height = landscape ? 612 : id === "06" || id === "07" ? 792 : 936;
    this.margin = id === "03" || id === "04" ? 36 : 54;
    this.contentWidth = this.width - this.margin * 2;
    this.newPage();
  }
  text(value: string, x: number, y: number, size = 11, bold = false, color = black) {
    this.page.drawText(clean(value), { x, y, size, font: bold ? this.resources.bold : this.resources.regular, color });
  }
  centered(value: string, y: number, size = 12, bold = false) {
    const font = bold ? this.resources.bold : this.resources.regular;
    this.text(value, (this.width - font.widthOfTextAtSize(clean(value), size)) / 2, y, size, bold);
  }
  newPage() {
    this.page = this.resources.doc.addPage([this.width, this.height]);
    this.pages.push(this.page);
    this.page.drawImage(this.resources.ust, { x: this.margin, y: this.height - 102, width: 66, height: 64 });
    this.page.drawImage(this.resources.comelec, { x: this.width - this.margin - 58, y: this.height - 98, width: 58, height: 58 });
    this.centered("UNIVERSITY OF SANTO TOMAS", this.height - 62, 12);
    this.centered("CENTRAL COMMISSION ON ELECTIONS", this.height - 81, 10);
    this.y = this.height - 125;
    // The source checklist starts with its title, without the numbered form line.
    if (this.id !== "07") {
      this.text(`COMELEC Form - POLPAR-${this.id}`, this.margin, this.y, 9);
      this.y -= 28;
    }
    if (this.showParty) {
      for (const line of linesFor(this.party, this.contentWidth, this.resources.bold, 13)) { this.centered(line, this.y, 13, true); this.y -= 18; }
      this.y -= 4;
    }
    this.centered(this.title, this.y, 13, true);
    this.y -= 32;
  }
  keep(height: number) { if (this.y - height < 54) this.newPage(); }
  paragraph(value: string, size = 11, leading = 17) {
    for (const line of linesFor(value, this.contentWidth, this.resources.regular, size)) {
      this.keep(leading);
      this.text(line, this.margin, this.y, size);
      this.y -= leading;
    }
    this.y -= 12;
  }
  signature(fullName: string, position: string, party = this.party) {
    const nameLines = linesFor(fullName, this.contentWidth, this.resources.bold, 11);
    const positionLines = linesFor(position, this.contentWidth, this.resources.regular, 10);
    const partyLines = linesFor(party, this.contentWidth, this.resources.regular, 10);
    this.keep(46 + (nameLines.length + positionLines.length + partyLines.length) * 15);
    this.y -= 28;
    this.page.drawLine({ start: { x: this.margin, y: this.y }, end: { x: this.margin + Math.min(280, this.contentWidth), y: this.y }, thickness: .6 });
    this.y -= 16;
    for (const line of nameLines) { this.text(line, this.margin, this.y, 11, true); this.y -= 15; }
    for (const line of [...positionLines, ...partyLines]) { this.text(line, this.margin, this.y, 10); this.y -= 15; }
    this.y -= 10;
  }
  table(headers: string[], weights: number[], rows: string[][], size = 9) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => this.contentWidth * weight / total);
    const compact = this.id === "07";
    const leading = size + (compact ? 2 : 4);
    const padding = compact ? 7 : 14;
    const headerLines = headers.map((label, i) => linesFor(label, widths[i] - 12, this.resources.bold, size));
    const headerHeight = Math.max(...headerLines.map((lines) => lines.length)) * leading + padding;
    const drawRow = (cells: string[][], height: number, header = false) => {
      let x = this.margin;
      cells.forEach((lines, i) => {
        this.page.drawRectangle({ x, y: this.y - height, width: widths[i], height, color: header ? black : white, borderColor: black, borderWidth: .5 });
        lines.forEach((line, index) => this.text(line, x + 6, this.y - (compact ? 4 : 10) - size - index * leading, size, header, header ? white : black));
        x += widths[i];
      });
      this.y -= height;
    };
    const header = () => { this.keep(headerHeight + leading + padding); drawRow(headerLines, headerHeight, true); };
    header();
    for (const row of rows) {
      const cells = row.map((value, i) => linesFor(value, widths[i] - 12, this.resources.regular, size));
      const count = Math.max(...cells.map((lines) => lines.length));
      let offset = 0;
      while (offset < count) {
        const fullHeight = (count - offset) * leading + padding;
        // Move ordinary rows as a unit. Very tall cells continue safely on the next page.
        if (this.y - fullHeight < 60 && this.y < this.height - 260) { this.newPage(); header(); }
        const fits = Math.floor((this.y - 60 - padding) / leading);
        if (fits < 1) { this.newPage(); header(); continue; }
        const take = Math.min(count - offset, fits);
        drawRow(cells.map((lines) => lines.slice(offset, offset + take)), take * leading + padding);
        offset += take;
        if (offset < count) { this.newPage(); header(); }
      }
    }
    this.y -= compact ? 10 : 22;
  }
  finish() {
    this.pages.forEach((page, index) => page.drawText(`POLPAR-${this.id}  |  Page ${index + 1} of ${this.pages.length}`, { x: this.margin, y: 27, size: 8, font: this.resources.regular, color: grey }));
  }
}

const originalCommunication = "I hereby declare that the information provided is true and correct. All forms of direct communication from the Commission shall be coursed through the contact number and email provided. It shall be the party’s responsibility to inform the Commission should there be any changes in the information stated herein.";

export async function generatePartyPdf(data: PdfInput, selection: PdfSelection, assets: PdfAssets): Promise<Uint8Array> {
  const checked = validatePdf(data, selection);
  if (!checked.success) throw new Error("Complete the fields for the selected form before downloading.");
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [regular, bold, ust, comelec] = await Promise.all([
    doc.embedFont(assets.regular, { subset: true }), doc.embedFont(assets.bold, { subset: true }), doc.embedJpg(assets.ust), doc.embedPng(assets.comelec),
  ]);
  // A missing glyph must be reported rather than silently replacing part of someone’s name.
  const supported = new Set(regular.getCharacterSet());
  const checkGlyphs = (value: unknown): void => {
    if (typeof value === "string") for (const character of clean(value)) if (!supported.has(character.codePointAt(0)!)) throw new Error(`The PDF font cannot display “${character}”. Please contact the Commission for help preserving this text.`);
    if (Array.isArray(value)) value.forEach(checkGlyphs);
    else if (value && typeof value === "object") Object.values(value).forEach(checkGlyphs);
  };
  checkGlyphs(data);
  const resources = { doc, regular, bold, ust, comelec };
  doc.setTitle(`${data.partyName} — ${selection === "all" ? "Political Party Registration" : `POLPAR-${selection}`}`);
  doc.setAuthor(data.submittedBy || data.partyName);
  doc.setSubject("Political party registration forms prepared from applicant-entered information");

  for (const { id } of pdfForms.filter((form) => selection === "all" || form.id === selection)) {
    if (id === "01") {
      const writer = new FormWriter(resources, id, "PETITION FOR REGISTRATION", data.partyName);
      writer.paragraph(`The ${data.partyName}${data.headquarters ? ` located at ${data.headquarters}` : ""}, and organized ${date(data.establishedAt)}, hereby seeks recognition before the UST Central Commission on Elections.`, 12, 21);
      writer.paragraph("It hereby declares not to pursue its goals through violence or other unlawful means; upholds and adheres to the Central Student Council Constitution and shall obey all laws, policies, and lawful orders promulgated by the University of Santo Tomas and other duly constituted authorities; and that it is not supported by, nor does it accept financial contribution or any aid of any person or groups of persons not enrolled in the University and/or of any organization not duly recognized by the University.", 12, 21);
      const [year, month, day] = data.petitionDate.split("-").map(Number);
      writer.paragraph(`The undersigned attests to the truthfulness of the above statements and declares under oath that he or she is authorized by the above-named political party and thereby binds the same for the purpose of filing this petition on the ${day} (day) of ${months[month - 1]} ${year} (month and year).`, 12, 21);
      writer.signature(data.petitionSignatory.fullName, data.petitionSignatory.position);
      writer.finish();
    } else if (["02", "03", "04", "05"].includes(id)) {
      const section = rosterSections[Number(id) - 2];
      const titles = { officers: "ROLL OF OFFICERS", members: "ROLL OF MEMBERS", alumni: "LIST OF ACTIVE ALUMNI MEMBERS", affiliates: "AFFILIATED LOCAL POLITICAL PARTY" };
      const headings = { officers: ["POSITION", "NAME", "COLLEGE", "STUDENT NO.", "CONTACT NO.", "EMAIL", "DATE OF RECRUITMENT"], members: ["FULL NAME", "COLLEGE", "STUDENT NO.", "CONTACT NUMBER", "DATE OF RECRUITMENT"], alumni: ["FULL NAME", "COLLEGE", "YEAR GRADUATED", "CONTACT NUMBER"], affiliates: ["NAME OF AFFILIATE", "ACADEMIC UNIT", "NAME OF CONTACT PERSON", "CONTACT NUMBER", "EMAIL"] };
      const weights = { officers: [1.1, 1.4, 1.5, 1, 1, 1.7, 1.1], members: [1.6, 1.5, 1, 1.1, 1.2], alumni: [1.6, 1.6, 1, 1.2], affiliates: [1.6, 1.5, 1.6, 1, 1.7] };
      const writer = new FormWriter(resources, id, titles[section.id], data.partyName, true);
      const rows = data[section.id];
      if (rows.length) writer.table(headings[section.id], weights[section.id], rows.map((row) => section.fields.map((field) => {
        const value = (row as Record<string, string>)[field.key];
        return field.key === "recruitedAt" ? date(value) : value;
      })));
      else { writer.table(headings[section.id], weights[section.id], [section.fields.map((_, index) => index === 0 ? "None declared" : "—")]); }
      writer.keep(145);
      writer.paragraph(section.id === "members" ? `This is to certify that the ${rows.length} aforementioned members of ${data.partyName} are bona fide students of the University of Santo Tomas.` : section.id === "alumni" ? `This is to certify that the ${rows.length} aforementioned alumni of ${data.partyName} are graduates of the University of Santo Tomas.` : originalCommunication, 10, 15);
      writer.signature(data.certifications[section.id].fullName, data.certifications[section.id].position);
      writer.finish();
    } else if (id === "06") {
      for (const member of data.conformes) {
        const writer = new FormWriter(resources, id, "CONFORME", data.partyName);
        writer.paragraph(`I, ${member.fullName}, from the ${member.college} with the student number ${member.studentNumber}, hereby declare, as an applicant member of ${data.partyName}, that:`, 11, 18);
        conformeDeclarations.forEach((declaration, index) => writer.paragraph(`${index + 1}. ${declaration}`, 11, 18));
        writer.signature(member.fullName, `Date: ${date(member.signedOn)}`, "Signature over printed name and date");
        writer.keep(150);
        writer.paragraph("Witnesses:", 11);
        const width = (writer.contentWidth - 28) / 2;
        const blocks = [
          { name: member.witness1Name, signed: member.witness1Date },
          { name: member.witness2Name, signed: member.witness2Date },
        ].map((witness) => [...linesFor(witness.name, width, bold, 10), `Date: ${date(witness.signed)}`]);
        writer.keep(Math.max(...blocks.map((block) => block.length)) * 14 + 60);
        writer.y -= 24;
        blocks.forEach((block, index) => {
          const x = writer.margin + index * (width + 28);
          writer.page.drawLine({ start: { x, y: writer.y }, end: { x: x + width, y: writer.y }, thickness: .6 });
          block.forEach((line, lineIndex) => writer.text(line, x, writer.y - 16 - lineIndex * 14, 10, lineIndex < block.length - 1));
          writer.text("Signature over printed name and date", x, writer.y - 22 - block.length * 14, 8);
        });
        writer.finish();
      }
    } else {
      const writer = new FormWriter(resources, id, "REGISTRATION OF POLITICAL PARTY", data.partyName);
      writer.table(["PARTICULARS", "INFORMATION"], [1, 2], [["POLITICAL PARTY", data.partyName], ["CONTACT PERSON", data.contactPerson], ["CONTACT NUMBER / EMAIL", `${data.contactNumber} / ${data.email}`]], 10);
      const checklist = ["Form 1 — Petition Form", "Form 2 — Roll of Officers", "Form 3 — Roll of Members", "Form 4 — List of Active Alumni", "Form 5 — List of Local Political Party Affiliates", "Clear photocopy of all officers’ and members’ registration forms", "Clear photocopy of all officers’ and members’ IDs", "Clear photocopy of all alumni’s alumni IDs", "Signed conforme", "Constitution and By-Laws", "Platform of government or declaration of political creed or code of political ethics", "Beginning financial statement"];
      writer.table(["", "CHECKLIST"], [.12, 1], checklist.map((label) => ["", label]), 9);
      writer.keep(215);
      writer.paragraph("Submitted by:", 10, 14);
      writer.signature(data.submittedBy, `${data.submittedPosition} of Political Party`);
      writer.keep(104);
      const x = writer.margin, right = writer.margin + writer.contentWidth / 2 + 12;
      writer.text("Received by:", x, writer.y, 10);
      writer.text("Certified true and complete:", right, writer.y, 10);
      writer.y -= 36;
      for (const start of [x, right]) writer.page.drawLine({ start: { x: start, y: writer.y }, end: { x: start + writer.contentWidth / 2 - 20, y: writer.y }, thickness: .6 });
      writer.text("Commissioner", x, writer.y - 17, 10);
      writer.text("Legal Head", right, writer.y - 17, 10);
      writer.text("UST Central Commission on Elections", x, writer.y - 32, 8);
      writer.text("UST Central Commission on Elections", right, writer.y - 32, 8);
      writer.text("Date and Time: _____________________", x, writer.y - 62, 10);
      writer.finish();
    }
  }
  return doc.save();
}

export async function downloadPartyPdf(data: PdfInput, selection: PdfSelection) {
  const asset = async (name: string) => {
    const response = await fetch(`/documents/polpar/assets/${name}`);
    if (!response.ok) throw new Error("The PDF template assets could not be loaded. Please try again.");
    return new Uint8Array(await response.arrayBuffer());
  };
  const [regular, bold, ust, comelec] = await Promise.all([asset("DejaVuSerif.ttf"), asset("DejaVuSerif-Bold.ttf"), asset("ust.jpg"), asset("comelec.png")]);
  const bytes = await generatePartyPdf(data, selection, { regular, bold, ust, comelec });
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${data.partyName.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 70) || "Political party"} - ${selection === "all" ? "POLPAR Forms 01-07" : `POLPAR-${selection}`}.pdf`;
  document.body.append(link); link.click(); link.remove();
  // Keep the Blob alive while browsers hand the download to their download manager.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
