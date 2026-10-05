// Reads formatted document drafts and legacy plain text. The public document page and portal
// preview share these blocks, so formatting and tables survive saving and publishing.
//
// Legacy tables: copying from Google Docs, Word or Google Sheets into a plain text
// box gives one line per row with a tab between cells. Two or more such lines in a row become a
// table; the first line is its header.

import { z } from "zod";
import type { CSSProperties } from "react";
export const DOCUMENT_DEFAULT_FONT_SIZE = 12;

export function normalizeDocumentHref(input: string): string | null {
  const value = input.trim();
  if (!value || /[\u0000-\u0020]/.test(value)) return null;
  const href = /^[a-z][\w+.-]*:/i.test(value) ? value : /^[^@/]+@[^@/]+\.[^@/]+$/.test(value) ? `mailto:${value}` : `https://${value}`;
  try {
    const url = new URL(href);
    return ["https:", "http:", "mailto:", "tel:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function normalizeDocumentColor(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (/^#[\da-f]{6}$/.test(value)) return value;
  if (/^#[\da-f]{3}$/.test(value)) return "#" + [...value.slice(1)].map(char => char + char).join("");
  const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb && rgb.slice(1).every(channel => Number(channel) <= 255)) return "#" + rgb.slice(1).map(channel => Number(channel).toString(16).padStart(2, "0")).join("");
  return null;
}

export function normalizeDocumentFontSize(input: string): number | null {
  const match = input.trim().match(/^(\d+(?:\.\d+)?)(px|pt)$/);
  if (!match) return null;
  const size = Number(match[1]) * (match[2] === "pt" ? 4 / 3 : 1);
  return size >= 8 && size <= 96 ? Math.round(size * 100) / 100 : null;
}

const layoutSchema = { align: z.enum(["left", "center", "right", "justify"]).optional(), indent: z.number().int().min(0).max(20).optional() };
const cellLayoutSchema = z.object({ ...layoutSchema, backgroundColor: z.string().regex(/^#[\da-f]{6}$/i).optional() });
export type DocumentCellLayout = z.infer<typeof cellLayoutSchema>;
const cellSpanSchema = z.object({ rowSpan: z.number().int().min(1).max(1000), colSpan: z.number().int().min(1).max(1000) });
export type DocumentCellSpan = z.infer<typeof cellSpanSchema>;
export type DocumentLayout = { align?: "left" | "center" | "right" | "justify"; indent?: number };
export function documentLayoutStyle(layout: DocumentLayout): CSSProperties | undefined {
  return layout.align || layout.indent ? { ...(layout.align && { textAlign: layout.align }), ...(layout.indent && { marginLeft: `${layout.indent * 24}px` }) } : undefined;
}

const runSchema = z.object({ text: z.string(), bold: z.boolean().optional(), italic: z.boolean().optional(), underline: z.boolean().optional(), href: z.string().refine(value => normalizeDocumentHref(value) === value).optional(), color: z.string().regex(/^#[\da-f]{6}$/i).optional(), fontSize: z.number().min(8).max(96).optional() });
const runsSchema = z.array(runSchema);
const listSchema = { items: z.array(runsSchema), start: z.number().int().min(1).max(1000000).optional(), ...layoutSchema };
const richBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("divider") }),
  z.object({ type: z.literal("text"), runs: runsSchema, ...layoutSchema }),
  z.object({ type: z.literal("bullets"), ...listSchema }),
  z.object({ type: z.literal("numbers"), ...listSchema }),
  z.object({ type: z.literal("grid"), header: runsSchema.array().nullable(), rows: runsSchema.array().array(), headerLayouts: cellLayoutSchema.array().optional(), rowLayouts: cellLayoutSchema.array().array().optional(), headerSpans: cellSpanSchema.array().optional(), rowSpans: cellSpanSchema.array().array().optional(), ...layoutSchema }),
]);

export type DocumentRun = z.infer<typeof runSchema>;
export type RichBodyBlock = z.infer<typeof richBlockSchema>;
export type BodyBlock = { type: "paragraph"; text: string } | { type: "table"; header: string[]; rows: string[][] } | RichBodyBlock;
const richPrefix = "::document-body:v1::\n";

/** Store only text and supported formatting, never arbitrary editor HTML. */
export function serializeDocumentBody(blocks: RichBodyBlock[]): string {
  return blocks.length ? richPrefix + JSON.stringify(blocks) : "";
}

const isTableLine = (line: string) => line.includes("\t") && line.replace(/\t/g, "").trim() !== "";

export function parseDocumentBody(text: string): BodyBlock[] {
  if (text.startsWith(richPrefix)) {
    try {
      const parsed = richBlockSchema.array().safeParse(JSON.parse(text.slice(richPrefix.length)));
      if (parsed.success) return parsed.data;
    } catch { /* Fall back to displaying malformed or older text literally. */ }
  }
  const blocks: BodyBlock[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let table: string[][] = [];

  const flushParagraph = () => {
    const joined = paragraph.join("\n").trim();
    if (joined) blocks.push({ type: "paragraph", text: joined });
    paragraph = [];
  };
  const flushTable = () => {
    if (table.length >= 2) {
      let width = Math.max(...table.map((row) => row.length));
      // Some apps add a trailing tab to every row; drop columns that are empty everywhere.
      while (width > 1 && table.every((row) => !row[width - 1])) width--;
      table = table.map((row) => row.slice(0, width));
      const [header, ...rows] = table.map((row) => [...row, ...Array(width - row.length).fill("")]);
      blocks.push({ type: "table", header, rows });
    } else if (table.length === 1) {
      // A single tab-separated line isn't a table — keep it as text.
      paragraph.push(table[0].join("  "));
    }
    table = [];
  };

  for (const line of lines) {
    if (isTableLine(line)) {
      flushParagraph();
      table.push(line.split("\t").map((cell) => cell.trim()));
    } else if (line.trim() === "") {
      flushTable();
      flushParagraph();
    } else {
      flushTable();
      paragraph.push(line);
    }
  }
  flushTable();
  flushParagraph();
  return blocks;
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function runsHtml(runs: DocumentRun[]) {
  return runs.map(run => {
    let html = escapeHtml(run.text).replace(/\n/g, "<br>");
    if (run.bold) html = `<strong>${html}</strong>`;
    if (run.italic) html = `<em>${html}</em>`;
    if (run.underline) html = `<u>${html}</u>`;
    const color = run.color && normalizeDocumentColor(run.color);
    const styles = [color && `color:${color}`, run.fontSize && `font-size:${run.fontSize}px`].filter(Boolean).join(";");
    if (styles) html = `<span style="${styles}">${html}</span>`;
    const href = run.href && normalizeDocumentHref(run.href);
    if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
    return html;
  }).join("");
}

/** Safe markup for initializing the visual editor, including legacy paragraphs and pasted tables. */
export function documentBodyHtml(blocks: BodyBlock[]): string {
  return blocks.map(block => {
    if (block.type === "divider") return '<hr class="document-divider">';
    if (block.type === "paragraph") return `<p>${runsHtml([{ text: block.text }])}</p>`;
    const layout = block.type === "table" ? "" : block.align ? `text-align:${block.align};` : "";
    const style = layout ? ` style="${layout}"` : "";
    // Native indent/outdent commands can edit these wrappers after a draft is reopened.
    const indent = block.type === "table" ? 0 : block.indent ?? 0;
    const wrap = (html: string) => "<blockquote>".repeat(indent) + html + "</blockquote>".repeat(indent);
    if (block.type === "text") return wrap(`<p${style}>${runsHtml(block.runs) || "<br>"}</p>`);
    if (block.type === "bullets" || block.type === "numbers") {
      const tag = block.type === "numbers" ? "ol" : "ul";
      return wrap(`<${tag}${style}${block.type === "numbers" && block.start ? ` start="${block.start}"` : ""}>${block.items.map(item => `<li>${runsHtml(item)}</li>`).join("")}</${tag}>`);
    }
    const header = block.type === "table" ? block.header.map(text => [{ text }]) : block.header;
    const rows = block.type === "table" ? block.rows.map(row => row.map(text => [{ text }])) : block.rows;
    const cellHtml = (cell: DocumentRun[], tag: "th" | "td", layout?: DocumentCellLayout, span?: DocumentCellSpan) => {
      const indent = layout?.indent ?? 0;
      const content = "<blockquote>".repeat(indent) + (runsHtml(cell) || "<br>") + "</blockquote>".repeat(indent);
      const background = layout?.backgroundColor && normalizeDocumentColor(layout.backgroundColor);
      const style = [layout?.align && `text-align:${layout.align}`, background && `background-color:${background}`].filter(Boolean).join(";");
      return `<${tag}${style ? ` style="${style}"` : ""}${span && span.rowSpan > 1 ? ` rowspan="${span.rowSpan}"` : ""}${span && span.colSpan > 1 ? ` colspan="${span.colSpan}"` : ""}>${content}</${tag}>`;
    };
    return wrap(`<table${style}>${header ? `<thead><tr>${header.map((cell, index) => cellHtml(cell, "th", block.type === "grid" ? block.headerLayouts?.[index] : undefined, block.type === "grid" ? block.headerSpans?.[index] : undefined)).join("")}</tr></thead>` : ""}<tbody>${rows.map((row, rowIndex) => `<tr>${row.map((cell, cellIndex) => cellHtml(cell, "td", block.type === "grid" ? block.rowLayouts?.[rowIndex]?.[cellIndex] : undefined, block.type === "grid" ? block.rowSpans?.[rowIndex]?.[cellIndex] : undefined)).join("")}</tr>`).join("")}</tbody></table>`);
  }).join("");
}
