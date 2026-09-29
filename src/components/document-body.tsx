import type { BodyBlock } from "@/lib/data/document-body";

/** Renders parsed document text: paragraphs, and tables that scroll sideways on small screens. */
export function DocumentBody({ blocks }: { blocks: BodyBlock[] }) {
  return blocks.map((block, index) =>
    block.type === "paragraph" ? (
      <p key={index}>{block.text}</p>
    ) : (
      <div className="document-table-wrap" key={index}>
        <table className="document-table">
          <thead><tr>{block.header.map((cell, cellIndex) => <th key={cellIndex} scope="col">{cell}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    ),
  );
}
