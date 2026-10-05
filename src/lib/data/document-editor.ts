import { normalizeDocumentColor, normalizeDocumentFontSize, normalizeDocumentHref, type DocumentLayout, type DocumentRun, type RichBodyBlock } from "./document-body";

const ignored = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "NOSCRIPT", "TEMPLATE"]);
const paragraphs = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"]);
type Marks = Omit<DocumentRun, "text">;

function marksOf(node: HTMLElement, marks: Marks): Marks {
  const next = { ...marks };
  if (["B", "STRONG"].includes(node.tagName) || node.style.fontWeight === "bold" || Number(node.style.fontWeight) >= 600) next.bold = true;
  if (["I", "EM"].includes(node.tagName) || node.style.fontStyle === "italic") next.italic = true;
  if (node.tagName === "U" || /underline/.test(node.style.textDecoration + node.style.textDecorationLine)) next.underline = true;
  if (node.tagName === "A") next.href = normalizeDocumentHref(node.getAttribute("href") ?? "") ?? undefined;
  const color = normalizeDocumentColor(node.style.color || (node.tagName === "FONT" ? node.getAttribute("color") ?? "" : ""));
  if (color) next.color = color;
  const fontSize = normalizeDocumentFontSize(node.style.fontSize) ?? (node.tagName === "FONT" ? [10, 13, 16, 18, 24, 32, 48][Number(node.getAttribute("size")) - 1] : undefined);
  if (fontSize) next.fontSize = fontSize;
  return next;
}

function inline(node: Node, marks: Marks = {}, runs: DocumentRun[] = []): DocumentRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/\u00a0/g, " ");
    if (text) runs.push({ text, ...marks });
  } else if (node instanceof HTMLElement && !ignored.has(node.tagName)) {
    if (node.tagName === "BR") runs.push({ text: "\n", ...marks });
    else {
      const next = marksOf(node, marks);
      if (paragraphs.has(node.tagName) && runs.length && !runs.at(-1)?.text.endsWith("\n")) runs.push({ text: "\n" });
      node.childNodes.forEach(child => inline(child, next, runs));
    }
  }
  return runs;
}

function layoutOf(node: HTMLElement, inherited: DocumentLayout): DocumentLayout {
  const layout = { ...inherited };
  const align = node.style.textAlign || node.getAttribute("align");
  if (align && ["left", "center", "right", "justify"].includes(align)) layout.align = align as DocumentLayout["align"];
  const margin = node.style.marginLeft;
  const extra = node.tagName === "BLOCKQUOTE" ? 1 : /^\d+(?:\.\d+)?px$/.test(margin) ? Math.round(parseFloat(margin) / 24) : 0;
  if (extra) layout.indent = Math.min(20, (layout.indent ?? 0) + extra);
  return layout;
}

/** Keep supported formatting and block layout, while discarding pasted executable markup. */
export function readDocumentEditor(root: HTMLElement): RichBodyBlock[] {
  const blocks: RichBodyBlock[] = [];
  let pending: DocumentRun[] = [];
  let pendingLayout: DocumentLayout = {};
  const flush = () => {
    if (pending.some(run => run.text.trim())) blocks.push({ type: "text", runs: pending, ...pendingLayout });
    pending = [];
  };
  const walk = (node: Node, inherited: DocumentLayout = {}, marks: Marks = {}) => {
    if (!(node instanceof HTMLElement)) { pendingLayout = inherited; inline(node, marks, pending); return; }
    if (ignored.has(node.tagName)) return;
    const layout = layoutOf(node, inherited);
    const nextMarks = marksOf(node, marks);
    if (node.tagName === "HR") {
      flush();
      blocks.push({ type: "divider" });
    } else if (node.tagName === "TABLE") {
      flush();
      const table = node as HTMLTableElement;
      const rows = [...table.rows].map(row => [...row.cells].map(cell => inline(cell, nextMarks)));
      const spans = [...table.rows].map(row => [...row.cells].map(cell => ({ rowSpan: Math.min(cell.rowSpan || 1000, (row.parentElement as HTMLTableSectionElement).rows.length - row.sectionRowIndex), colSpan: cell.colSpan })));
      const merged = spans.some(row => row.some(cell => cell.rowSpan > 1 || cell.colSpan > 1));
      const cellLayouts = [...table.rows].map(row => [...row.cells].map(cell => {
        let layout = layoutOf(cell, {});
        let child = cell.querySelector<HTMLElement>("p, div, blockquote");
        while (child) { layout = layoutOf(child, layout); child = child.querySelector<HTMLElement>("p, div, blockquote"); }
        const backgroundColor = normalizeDocumentColor(cell.style.backgroundColor);
        return { ...layout, ...(backgroundColor && { backgroundColor }) };
      }));
      const styledCells = cellLayouts.some(row => row.some(cell => cell.align || cell.indent || cell.backgroundColor));
      const hasHeader = Boolean(table.rows[0]?.querySelector("th"));
      if (rows.length) {
        const width = Math.max(...rows.map(row => row.length));
        if (!merged) for (const row of rows) while (row.length < width) row.push([]);
        const header = hasHeader ? rows.shift()! : null;
        const headerLayouts = hasHeader ? cellLayouts.shift()! : undefined;
        const headerSpans = hasHeader ? spans.shift()! : undefined;
        blocks.push({ type: "grid", header, rows, ...(styledCells && { ...(headerLayouts && { headerLayouts }), rowLayouts: cellLayouts }), ...(merged && { ...(headerSpans && { headerSpans }), rowSpans: spans }), ...layout });
      }
    } else if (node.tagName === "UL" || node.tagName === "OL") {
      flush();
      const type = node.tagName === "OL" ? "numbers" : "bullets";
      const start = Math.max(1, Math.min(1000000, Number(node.getAttribute("start")) || 1));
      let items: DocumentRun[][] = [];
      let groupStart = start;
      let groupLayout = layout;
      const flushItems = () => {
        if (items.length) blocks.push({ type, items, ...(type === "numbers" && groupStart !== 1 && { start: groupStart }), ...groupLayout });
        items = [];
      };
      let itemIndex = 0;
      [...node.children].forEach(item => {
        // Chromium's indent command can nest a list directly under another list, outside a LI.
        if (item.tagName !== "LI") {
          if (["TABLE", "UL", "OL", "HR"].includes(item.tagName)) {
            flushItems();
            walk(item, item.tagName === "TABLE" ? layout : { ...layout, indent: Math.min(20, (layout.indent ?? 0) + 1) }, nextMarks);
          }
          return;
        }
        const index = itemIndex++;
        const itemLayout = layoutOf(item as HTMLElement, layout);
        if (JSON.stringify(itemLayout) !== JSON.stringify(groupLayout)) flushItems();
        groupLayout = itemLayout;
        let runs: DocumentRun[] = [];
        const pushItem = () => {
          if (runs.some(run => run.text.trim())) {
            if (!items.length) groupStart = start + index;
            items.push(runs);
          }
          runs = [];
        };
        const splitItem = (child: Node) => {
          if (child instanceof HTMLElement && ["TABLE", "UL", "OL", "HR"].includes(child.tagName)) {
            pushItem();
            flushItems();
            walk(child, child.tagName === "TABLE" ? itemLayout : { ...itemLayout, indent: Math.min(20, (itemLayout.indent ?? 0) + 1) }, nextMarks);
          } else if (child instanceof HTMLElement && child.querySelector("table, ul, ol, hr")) child.childNodes.forEach(splitItem);
          else inline(child, marksOf(item as HTMLElement, nextMarks), runs);
        };
        item.childNodes.forEach(splitItem);
        pushItem();
      });
      flushItems();
    } else if (paragraphs.has(node.tagName) || node.querySelector("p, div, ul, ol, table, hr")) {
      flush();
      if (node.querySelector("p, div, ul, ol, table, hr")) node.childNodes.forEach(child => walk(child, layout, nextMarks));
      else { pending = inline(node, marks); pendingLayout = layout; }
      flush();
    } else {
      pendingLayout = layout;
      inline(node, marks, pending);
    }
  };
  root.childNodes.forEach(child => walk(child));
  flush();
  return blocks;
}
