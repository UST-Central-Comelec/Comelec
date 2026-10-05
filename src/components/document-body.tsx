import { DOCUMENT_DEFAULT_FONT_SIZE, documentLayoutStyle, normalizeDocumentColor, normalizeDocumentHref, type BodyBlock, type DocumentCellLayout, type DocumentRun } from "@/lib/data/document-body";
import type { ReactNode } from "react";

function Inline({ runs }: { runs: DocumentRun[] }) {
  return runs.map((run, index) => {
    let content: ReactNode = run.text;
    if (run.bold) content = <strong>{content}</strong>;
    if (run.italic) content = <em>{content}</em>;
    if (run.underline) content = <u>{content}</u>;
    const href = run.href && normalizeDocumentHref(run.href);
    if (href) content = <a href={href}>{content}</a>;
    return <span key={index} style={{ ...(run.text.includes("\t") && { whiteSpace: "pre-wrap", tabSize: 4 }), ...(run.color && { color: run.color }), fontSize: `${run.fontSize ?? DOCUMENT_DEFAULT_FONT_SIZE}px` }}>{content}</span>;
  });
}

const cellStyle = (layout?: DocumentCellLayout) => layout ? { ...(layout.align && { textAlign: layout.align }), ...(layout.indent && { paddingLeft: `${12 + layout.indent * 24}px` }), ...(layout.backgroundColor && { backgroundColor: normalizeDocumentColor(layout.backgroundColor) ?? undefined }) } : undefined;

/** Renders parsed document text: paragraphs, and tables that scroll sideways on small screens. */
export function DocumentBody({ blocks }: { blocks: BodyBlock[] }) {
  return blocks.map((block, index) => {
    if (block.type === "divider") return <hr key={index} className="document-divider" />;
    if (block.type === "paragraph") return <p key={index} style={{ fontSize: DOCUMENT_DEFAULT_FONT_SIZE }}>{block.text}</p>;
    if (block.type === "text") return <p key={index} style={{ ...documentLayoutStyle(block), fontSize: DOCUMENT_DEFAULT_FONT_SIZE }}><Inline runs={block.runs} /></p>;
    if (block.type === "bullets" || block.type === "numbers") {
      const Tag = block.type === "numbers" ? "ol" : "ul";
      return <Tag key={index} start={block.type === "numbers" ? block.start : undefined} className={block.type === "numbers" ? "document-numbers" : "document-bullets"} style={{ ...documentLayoutStyle(block), fontSize: DOCUMENT_DEFAULT_FONT_SIZE }}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline runs={item} /></li>)}</Tag>;
    }
    const header = block.type === "table" ? block.header.map(text => [{ text }]) : block.header;
    const rows = block.type === "table" ? block.rows.map(row => row.map(text => [{ text }])) : block.rows;
    return (
      <div className="document-table-wrap" key={index}>
        <table className="document-table" style={block.type === "grid" ? documentLayoutStyle(block) : undefined}>
          {header && <thead><tr>{header.map((cell, cellIndex) => <th key={cellIndex} scope="col" rowSpan={block.type === "grid" ? block.headerSpans?.[cellIndex]?.rowSpan : undefined} colSpan={block.type === "grid" ? block.headerSpans?.[cellIndex]?.colSpan : undefined} style={cellStyle(block.type === "grid" ? block.headerLayouts?.[cellIndex] : undefined)}><Inline runs={cell} /></th>)}</tr></thead>}
          <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} rowSpan={block.type === "grid" ? block.rowSpans?.[rowIndex]?.[cellIndex]?.rowSpan : undefined} colSpan={block.type === "grid" ? block.rowSpans?.[rowIndex]?.[cellIndex]?.colSpan : undefined} style={cellStyle(block.type === "grid" ? block.rowLayouts?.[rowIndex]?.[cellIndex] : undefined)}><Inline runs={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  });
}
